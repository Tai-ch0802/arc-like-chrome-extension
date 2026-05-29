/**
 * Workspace Manager
 *
 * A Workspace is a saved bundle of (tabs + optional bookmark folder hint) that
 * the user can hibernate and restore as a unit.
 *
 * Storage layout (Phase 9: metadata cross-device sync):
 *   chrome.storage.sync.workspaceMetadata     → { [id]: Metadata }
 *   chrome.storage.local.workspaceSnapshots   → { [id]: TabSnapshot[] }
 *   chrome.storage.local.windowWorkspaceMap   → { [windowId]: workspaceId }
 *
 * Why split:
 * - sync has an 8KB-per-key budget; a workspace with 30 tabs is already
 *   2-3KB, so we'd hit the cap with just a few workspaces.
 * - The user-visible identity (name, color, icon, bookmark hint) IS small
 *   and useful to mirror across devices.
 * - tabSnapshot is per-device anyway — restoring on another machine should
 *   open the user's CURRENT machine's tabs, not yesterday's laptop's.
 * - windowWorkspaceMap uses ephemeral chrome window ids, useless on another
 *   device. Stays local.
 *
 * Legacy migration:
 *   Phase 6 stored a unified `chrome.storage.local.workspaces` key.
 *   On first run after Phase 9, we split it into metadata + snapshots and
 *   drop the legacy key.
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
 * @property {number} [groupKey]    - 快照當下的原始 groupId，僅作同一快照內分群識別
 * @property {string} [groupTitle]
 * @property {string} [groupColor]
 */
import { getStorage, setStorage, setStorageStrict, addTabToNewGroup } from '../apiManager.js';

const LEGACY_WORKSPACES_KEY = 'workspaces';            // pre-Phase-9 unified key
const WORKSPACE_METADATA_KEY = 'workspaceMetadata';     // sync
const WORKSPACE_SNAPSHOTS_KEY = 'workspaceSnapshots';   // local
const WINDOW_WORKSPACE_MAP_KEY = 'windowWorkspaceMap';  // local (per-device)

const PRESET_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
const PRESET_ICONS = ['💼', '📚', '🎯', '🧪', '🎨', '🚀', '🏠', '🛒'];

/** @type {Object<string, Workspace>} In-memory mirror of storage. */
let workspaces = {};
/** @type {Object<string, string>} windowId → workspaceId. */
let windowWorkspaceMap = {};

export async function initWorkspaces() {
    const [syncRes, localRes] = await Promise.all([
        getStorage('sync', [WORKSPACE_METADATA_KEY]),
        getStorage('local', [WORKSPACE_SNAPSHOTS_KEY, WINDOW_WORKSPACE_MAP_KEY, LEGACY_WORKSPACES_KEY]),
    ]);

    let metadata = syncRes[WORKSPACE_METADATA_KEY] || {};
    let snapshots = localRes[WORKSPACE_SNAPSHOTS_KEY] || {};
    windowWorkspaceMap = localRes[WINDOW_WORKSPACE_MAP_KEY] || {};

    // One-time migration from Phase 6's unified `workspaces` key.
    const legacy = localRes[LEGACY_WORKSPACES_KEY];
    const noNewData = Object.keys(metadata).length === 0 && Object.keys(snapshots).length === 0;
    if (legacy && Object.keys(legacy).length > 0 && noNewData) {
        for (const [id, ws] of Object.entries(legacy)) {
            const { tabSnapshot, ...meta } = ws;
            metadata[id] = meta;
            snapshots[id] = tabSnapshot || [];
        }
        try {
            // Strict variant so a silent sync write failure (quota / sync
            // unavailable) doesn't pretend the migration succeeded and end
            // up with snapshots-only and no metadata on next init.
            await Promise.all([
                setStorageStrict('sync', { [WORKSPACE_METADATA_KEY]: metadata }),
                setStorageStrict('local', { [WORKSPACE_SNAPSHOTS_KEY]: snapshots }),
            ]);
        } catch (err) {
            // Roll back the in-memory view so the rebuild below uses legacy data,
            // and KEEP legacy in storage so next launch can retry the migration.
            console.warn('[workspace] migration write failed, keeping legacy:', err);
            metadata = {};
            snapshots = {};
            for (const [id, ws] of Object.entries(legacy)) {
                const { tabSnapshot, ...meta } = ws;
                metadata[id] = meta;
                snapshots[id] = tabSnapshot || [];
            }
        }
        // INTENTIONALLY do NOT delete LEGACY_WORKSPACES_KEY here. The `noNewData`
        // guard already prevents re-migration once new keys are populated; the
        // ~few KB of disk used by the legacy backup is cheap insurance against
        // ever losing the only complete copy of the user's workspace identity.
    }

    // Rebuild the in-memory full-object form so callers don't need to know
    // about the split storage.
    workspaces = {};
    for (const [id, meta] of Object.entries(metadata)) {
        workspaces[id] = { ...meta, tabSnapshot: snapshots[id] || [] };
    }
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

/**
 * 把 chrome.tabs.query 結果映射成 TabSnapshot[]，對分組分頁帶上 group 資訊。
 * 純函式，便於單元測試。
 * @param {Array<{url:string,title?:string,pinned?:boolean,groupId?:number}>} tabs
 * @param {Map<number,{title?:string,color:string}>} groupsById
 * @returns {Array}
 */
export function buildSnapshotFromTabs(tabs, groupsById) {
    return tabs
        .filter(t => t.url && /^(https?|file|ftp):/i.test(t.url))
        .map(t => {
            const snap = { url: t.url, title: t.title || '', pinned: Boolean(t.pinned) };
            const g = (t.groupId != null && t.groupId !== -1 && groupsById)
                ? groupsById.get(t.groupId)
                : null;
            if (g) {
                snap.groupKey = t.groupId;
                snap.groupTitle = g.title || '';
                snap.groupColor = g.color;
            }
            return snap;
        });
}

/**
 * 把已成功建立的還原分頁依其原始 groupKey 分群，供 addTabToNewGroup 重建。
 * 排除：建立失敗 (id 為 null/undefined)、未分組、pinned（無法進 group）。
 * 純函式。
 * @param {Array} snapshotTabs - TabSnapshot[]，與 createdTabIds 同 index 對齊
 * @param {Array<number|null>} createdTabIds - 每個 index 對應的新分頁 id（失敗為 null）
 * @returns {Array<{tabIds: number[], title: string, color: string}>}
 */
export function clusterCreatedTabsByGroup(snapshotTabs, createdTabIds) {
    const order = [];
    const byKey = new Map();
    for (let i = 0; i < snapshotTabs.length; i++) {
        const s = snapshotTabs[i];
        const tabId = createdTabIds[i];
        if (tabId == null) continue;
        if (s.groupKey == null) continue;
        if (s.pinned) continue;
        if (!byKey.has(s.groupKey)) {
            byKey.set(s.groupKey, { tabIds: [], title: s.groupTitle || '', color: s.groupColor });
            order.push(s.groupKey);
        }
        byKey.get(s.groupKey).tabIds.push(tabId);
    }
    return order.map(k => byKey.get(k)).filter(c => c.tabIds.length > 0);
}

async function snapshotWindowTabs(windowId) {
    const [tabs, groups] = await Promise.all([
        chrome.tabs.query({ windowId }).catch(() => []),
        chrome.tabGroups.query({ windowId }).catch(() => []),
    ]);
    const groupsById = new Map(groups.map(g => [g.id, { title: g.title, color: g.color }]));
    // chrome:// / about: pages are filtered inside buildSnapshotFromTabs.
    return buildSnapshotFromTabs(tabs, groupsById);
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
    const createdTabIds = [];
    // Sequential create keeps the restored tab order stable. ~30ms/tab × 30 tabs
    // ≈ 1s worst case, acceptable for an explicit user action behind a confirm.
    for (let i = 0; i < snapshotTabs.length; i++) {
        const s = snapshotTabs[i];
        try {
            const newTab = await chrome.tabs.create({
                windowId,
                url: s.url,
                active: i === 0,
                pinned: s.pinned || false,
            });
            createdTabIds.push(newTab.id);
            createdCount++;
        } catch (err) {
            createdTabIds.push(null);
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

    // Best-effort: rebuild the tab groups the snapshot captured. A failure here
    // must NOT undo the successful tab restore, so it's fully wrapped.
    try {
        const clusters = clusterCreatedTabsByGroup(snapshotTabs, createdTabIds);
        for (const c of clusters) {
            try {
                await addTabToNewGroup(c.tabIds, c.title, c.color, windowId);
            } catch (err) {
                console.warn('[workspace] failed to restore tab group', c.title, err);
            }
        }
    } catch (err) {
        console.warn('[workspace] group restore failed', err);
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

/**
 * Persists both metadata (sync) and snapshots (local) in parallel. Writes both
 * on every mutation rather than tracking which side changed — simpler and the
 * workspace operations are low-frequency enough that the extra write is fine
 * relative to chrome.storage.sync's 120 writes/minute cap.
 *
 * Uses setStorageStrict for the sync write so that a quota-exceeded failure
 * (single-key budget is 8KB → ~30 workspaces' metadata) is logged rather than
 * silently swallowed. Local write is still silent (local quota is ~10MB and
 * failure here would mean disk is in real trouble). Caller's await wraps the
 * whole Promise.all so any reject surfaces as a rejected promise.
 */
function persistWorkspaces() {
    const metadata = {};
    const snapshots = {};
    for (const [id, ws] of Object.entries(workspaces)) {
        const { tabSnapshot, ...meta } = ws;
        metadata[id] = meta;
        snapshots[id] = tabSnapshot || [];
    }
    return Promise.all([
        setStorageStrict('sync', { [WORKSPACE_METADATA_KEY]: metadata })
            .catch(err => {
                // Don't propagate — the workspace mutation that triggered this
                // is already locally applied via persistWorkspaces' caller;
                // failing here would leave the in-memory state inconsistent
                // with what local snapshots show. Log loudly so a follow-up
                // can offer the user a retry / per-key migration. v2 todo.
                console.warn(
                    '[workspace] sync metadata write failed (sync disabled, quota, or ~30+ workspaces). '
                    + 'Local snapshot still saved; cross-device sync is offline:',
                    err
                );
            }),
        setStorage('local', { [WORKSPACE_SNAPSHOTS_KEY]: snapshots }),
    ]);
}

function persistWindowMap() {
    return setStorage('local', { [WINDOW_WORKSPACE_MAP_KEY]: windowWorkspaceMap });
}
