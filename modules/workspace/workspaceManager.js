/**
 * Workspace Manager
 *
 * A Workspace is a saved bundle of (tabs + optional bookmark folder hint) that
 * the user can hibernate and restore as a unit. Storage layout:
 *
 *   chrome.storage.local.workspaces            → { [id]: Workspace }
 *   chrome.storage.local.windowWorkspaceMap    → { [windowId]: workspaceId }
 *
 * @typedef {Object} Workspace
 * @property {string} id
 * @property {string} name
 * @property {string} color      - 8 preset colors (matches tab group palette)
 * @property {string} icon       - single emoji
 * @property {string} [bookmarkFolderId]  - optional Chrome bookmark folder hint
 * @property {TabSnapshot[]} tabSnapshot
 * @property {number} lastActiveAt
 *
 * @typedef {Object} TabSnapshot
 * @property {string} url
 * @property {string} title
 * @property {boolean} [pinned]
 *
 * Design choices:
 * - Storage in `local` not `sync`: snapshots can hold dozens of tabs, far
 *   exceeding sync's 8KB-per-key budget. Phase 9 will add an opt-in sync
 *   variant for the workspace metadata (without snapshots).
 * - In-memory cache mirrors storage; CRUD writes through. Other sidepanels
 *   pick up changes via the cross-sidepanel storage subscriber (Phase 2).
 * - Group membership is intentionally NOT snapshotted in v1. Restoring group
 *   structure requires recreating chrome.tabGroups in a stable order, which
 *   we'll add in a follow-up if user feedback asks for it.
 */
import { getStorage, setStorage } from '../apiManager.js';

const WORKSPACES_KEY = 'workspaces';
const WINDOW_WORKSPACE_MAP_KEY = 'windowWorkspaceMap';

const PRESET_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
const PRESET_ICONS = ['💼', '📚', '🎯', '🧪', '🎨', '🚀', '🏠', '🛒'];

/** @type {Object<string, Workspace>} In-memory mirror of storage. */
let workspaces = {};
/** @type {Object<string, string>} windowId → workspaceId. */
let windowWorkspaceMap = {};

export async function initWorkspaces() {
    const result = await getStorage('local', [WORKSPACES_KEY, WINDOW_WORKSPACE_MAP_KEY]);
    workspaces = result[WORKSPACES_KEY] || {};
    windowWorkspaceMap = result[WINDOW_WORKSPACE_MAP_KEY] || {};
}

export function getAllWorkspaces() {
    // Returned sorted by lastActiveAt desc so the switcher's most-recent entries
    // surface first. Newly created workspaces (lastActiveAt = now) lead.
    return Object.values(workspaces).sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
}

export function getWorkspace(id) {
    return workspaces[id] || null;
}

export function getActiveWorkspaceId(windowId) {
    return windowWorkspaceMap[String(windowId)] || null;
}

export function getPresetColors() { return [...PRESET_COLORS]; }
export function getPresetIcons() { return [...PRESET_ICONS]; }

/**
 * Creates a Workspace. Optionally snapshots the current window's tabs into it.
 * @param {{name: string, color?: string, icon?: string, bookmarkFolderId?: string, snapshotWindowId?: number}} args
 * @returns {Promise<Workspace>}
 */
export async function createWorkspace(args) {
    const id = 'ws_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const ws = {
        id,
        name: (args.name || 'Workspace').trim().slice(0, 60),
        color: PRESET_COLORS.includes(args.color) ? args.color : 'blue',
        icon: (args.icon && args.icon.length <= 4) ? args.icon : '💼',
        bookmarkFolderId: args.bookmarkFolderId || undefined,
        tabSnapshot: [],
        lastActiveAt: Date.now(),
    };
    if (typeof args.snapshotWindowId === 'number') {
        ws.tabSnapshot = await snapshotWindowTabs(args.snapshotWindowId);
    }
    workspaces[id] = ws;
    await persistWorkspaces();
    return ws;
}

/**
 * @param {string} id
 * @param {Partial<Workspace>} updates
 */
export async function updateWorkspace(id, updates) {
    const ws = workspaces[id];
    if (!ws) return null;
    if (updates.name !== undefined) ws.name = updates.name.trim().slice(0, 60);
    if (updates.color !== undefined && PRESET_COLORS.includes(updates.color)) ws.color = updates.color;
    if (updates.icon !== undefined && updates.icon.length <= 4) ws.icon = updates.icon;
    if (updates.bookmarkFolderId !== undefined) ws.bookmarkFolderId = updates.bookmarkFolderId || undefined;
    await persistWorkspaces();
    return ws;
}

export async function deleteWorkspace(id) {
    delete workspaces[id];
    // Detach any window currently bound to it.
    for (const wid of Object.keys(windowWorkspaceMap)) {
        if (windowWorkspaceMap[wid] === id) delete windowWorkspaceMap[wid];
    }
    await Promise.all([persistWorkspaces(), persistWindowMap()]);
}

/**
 * Replaces the workspace's tabSnapshot with the current state of `windowId`.
 * Pinned and chrome:// tabs are kept (we re-open them on restore).
 * @param {string} id
 * @param {number} windowId
 */
export async function snapshotIntoWorkspace(id, windowId) {
    const ws = workspaces[id];
    if (!ws) return null;
    ws.tabSnapshot = await snapshotWindowTabs(windowId);
    ws.lastActiveAt = Date.now();
    await persistWorkspaces();
    return ws;
}

export async function setActiveWorkspace(windowId, workspaceId) {
    if (workspaceId === null || workspaceId === undefined) {
        delete windowWorkspaceMap[String(windowId)];
    } else {
        windowWorkspaceMap[String(windowId)] = workspaceId;
        const ws = workspaces[workspaceId];
        if (ws) {
            ws.lastActiveAt = Date.now();
            await persistWorkspaces();
        }
    }
    await persistWindowMap();
}

async function snapshotWindowTabs(windowId) {
    const tabs = await chrome.tabs.query({ windowId }).catch(() => []);
    return tabs
        // Don't snapshot chrome:// or about: pages — they often can't be
        // re-opened in normal tabs and would clutter the restore set.
        .filter(t => t.url && /^(https?|file|ftp):/i.test(t.url))
        .map(t => ({
            url: t.url,
            title: t.title || '',
            pinned: Boolean(t.pinned),
        }));
}

/**
 * Hibernate-then-restore switch:
 *   1) ensure the outgoing tabs are saved somewhere — either the currently-
 *      bound workspace, or (if the window is unbound) a fresh auto-created
 *      "Untitled <timestamp>" workspace. NEVER discard unbound tabs silently;
 *   2) open the target workspace's snapshot in the same window;
 *   3) close the original tabs IFF we successfully opened at least one new
 *      tab, otherwise abort to avoid emptying the window;
 *   4) bind window → target workspace.
 *
 * Open before close: removing the last tab in a window auto-closes the
 * window. Empty target snapshot opens one blank tab for the same reason.
 *
 * @param {string} targetId
 * @param {number} windowId
 * @returns {Promise<boolean>} true if switched.
 * @throws if no target tab could be opened (window left untouched).
 */
export async function switchWorkspace(targetId, windowId) {
    if (!workspaces[targetId]) return false;
    const currentActiveId = getActiveWorkspaceId(windowId);
    if (currentActiveId === targetId) return false;

    if (currentActiveId) {
        await snapshotIntoWorkspace(currentActiveId, windowId);
    } else {
        // Unbound window: auto-save current tabs to a recovery workspace before
        // we close them. Without this, the user's tabs would vanish on every
        // first switch after a browser restart (windowWorkspaceMap uses
        // ephemeral window ids and is not rebuilt on startup).
        const oldTabs = await chrome.tabs.query({ windowId }).catch(() => []);
        if (oldTabs.length > 0) {
            await createWorkspace({
                name: 'Untitled ' + formatTimestamp(),
                snapshotWindowId: windowId,
            });
        }
    }

    const target = workspaces[targetId];
    const snapshotTabs = (target.tabSnapshot && target.tabSnapshot.length > 0)
        ? target.tabSnapshot
        : [{ url: 'chrome://newtab/', title: '', pinned: false }];

    const oldTabs = await chrome.tabs.query({ windowId }).catch(() => []);
    const oldTabIds = oldTabs.map(t => t.id);

    let createdCount = 0;
    // Sequential create keeps the restored tab order stable. ~30ms/tab × 30 tabs
    // ≈ 1s worst case, acceptable for an explicit user action behind a confirm.
    for (let i = 0; i < snapshotTabs.length; i++) {
        const s = snapshotTabs[i];
        try {
            await chrome.tabs.create({
                windowId,
                url: s.url,
                active: i === 0,
                pinned: s.pinned || false,
            });
            createdCount++;
        } catch (err) {
            console.warn('[workspace] failed to restore tab', s.url, err);
        }
    }

    if (createdCount === 0) {
        // Don't close old tabs if we have nothing to replace them with —
        // would leave the window empty and Chrome would auto-close it.
        throw new Error('Could not open any tab from the target workspace snapshot.');
    }

    if (oldTabIds.length > 0) {
        try {
            await chrome.tabs.remove(oldTabIds);
        } catch (err) {
            console.warn('[workspace] failed to close old tabs', err);
        }
    }

    await setActiveWorkspace(windowId, targetId);
    return true;
}

/**
 * Removes window→workspace entries for windows that no longer exist.
 * Called on init to clean up ephemeral ids that pile up across sessions.
 */
export async function pruneWindowWorkspaceMap() {
    const allWindows = await chrome.windows.getAll().catch(() => []);
    const aliveIds = new Set(allWindows.map(w => String(w.id)));
    let changed = false;
    for (const wid of Object.keys(windowWorkspaceMap)) {
        if (!aliveIds.has(wid)) {
            delete windowWorkspaceMap[wid];
            changed = true;
        }
    }
    if (changed) await persistWindowMap();
}

function formatTimestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function persistWorkspaces() {
    return setStorage('local', { [WORKSPACES_KEY]: workspaces });
}

function persistWindowMap() {
    return setStorage('local', { [WINDOW_WORKSPACE_MAP_KEY]: windowWorkspaceMap });
}
