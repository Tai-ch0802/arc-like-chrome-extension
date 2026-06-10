/**
 * Workspace Manager
 *
 * A Workspace is a saved bundle of (tabs + optional bookmark folder hint) that
 * the user can hibernate and restore as a unit.
 *
 * Storage layout v2 (ISSUE-162 WP1: per-id keys):
 *   chrome.storage.sync ["wsMeta_"+id]   → identity {id,name,color,icon,bookmarkFolderId,syncEnabled,lastActiveAt}
 *   chrome.storage.local["wsSnap_"+id]   → content  {tabs: TabSnapshot[], rev, updatedAt}
 *   chrome.storage.local.windowWorkspaceMap → { [windowId]: workspaceId }
 *
 * Why split:
 * - Per-id keys: the sidepanel and the background SW each hold an in-memory
 *   mirror; v1's whole-map writes let a stale mirror clobber OTHER workspaces'
 *   fresh data. Per-id keys + read→merge→write (writeSnapRecord) confine any
 *   race to a single workspace's own fields.
 * - rev/updatedAt live in the LOCAL record so the high-frequency auto-snapshot
 *   path consumes zero chrome.storage.sync write quota.
 * - Identity (name, color, icon, hint) is small and mirrors across devices.
 * - tabSnapshot is per-device anyway — restoring on another machine should
 *   open the user's CURRENT machine's tabs, not yesterday's laptop's.
 * - windowWorkspaceMap uses ephemeral chrome window ids, useless on another
 *   device. Stays local.
 *
 * Legacy migration (collapsed into one pass, see migrateLegacyToV2):
 *   Phase 6 unified `local.workspaces` → v1 split maps → v2 per-id keys.
 *   Local legacy keys are kept as backup; the v1 SYNC map is deleted after
 *   migration to stop mixed-version devices cross-writing it.
 *
 * @typedef {Object} Workspace
 * @property {string} id
 * @property {string} name
 * @property {string} color      - 8 preset colors (matches tab group palette)
 * @property {string} icon       - single emoji
 * @property {string} [bookmarkFolderId]  - optional Chrome bookmark folder hint
 * @property {TabSnapshot[]} tabSnapshot
 * @property {number} lastActiveAt
 * @property {number} rev          - content revision, bumped on every CONTENT change (NOT on mere activation). Conflict ordering key for Drive sync.
 * @property {number} updatedAt     - epoch ms of the last content change.
 * @property {boolean} [syncEnabled] - whether this workspace participates in Google Drive sync (cross-device intent).
 *
 * @typedef {Object} TabSnapshot
 * @property {string} url
 * @property {string} title
 * @property {boolean} [pinned]
 * @property {number} [groupKey]    - 快照當下的原始 groupId，僅作同一快照內分群識別
 * @property {string} [groupTitle]
 * @property {string} [groupColor]
 */
import { getStorage, setStorage, setStorageStrict, removeStorage, addTabToNewGroup } from '../apiManager.js';
import { renderIcon, hasIcon } from '../icons.js';
import { escapeHtml } from '../utils/textUtils.js';

// --- Storage schema v2 (ISSUE-162 WP1) ---------------------------------------
// Per-workspace keys so concurrent writers (sidepanel mirror vs background SW
// mirror) can never clobber OTHER workspaces' data with a stale full-map write:
//   chrome.storage.sync ["wsMeta_"+id]  → { id, name, color, icon,
//                                           bookmarkFolderId, syncEnabled, lastActiveAt }
//   chrome.storage.local["wsSnap_"+id]  → { tabs: TabSnapshot[], rev, updatedAt }
// rev/updatedAt live in the LOCAL record so the high-frequency auto-snapshot
// path never consumes chrome.storage.sync write quota (FR-02).
// Same-id writes additionally use read→merge→write so each path only
// overwrites the fields it owns (see writeSnapRecord).
const WS_META_PREFIX = 'wsMeta_';                       // sync, per-id identity
const WS_SNAP_PREFIX = 'wsSnap_';                       // local, per-id content
const LEGACY_WORKSPACES_KEY = 'workspaces';             // pre-Phase-9 unified key (local, kept as backup)
const LEGACY_METADATA_KEY = 'workspaceMetadata';        // v1 sync map (removed after v2 migration)
const LEGACY_SNAPSHOTS_KEY = 'workspaceSnapshots';      // v1 local map (kept as backup)
const WINDOW_WORKSPACE_MAP_KEY = 'windowWorkspaceMap';  // local (per-device; ALL writes go through mutateWindowMap — never persist the in-memory map wholesale)

const PRESET_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
// 工作區圖示改存 Material Symbols icon-id(過往裝置可能仍存 emoji 字串,由 resolveWorkspaceIcon 相容)。
const PRESET_ICONS = ['work', 'menu_book', 'track_changes', 'science', 'palette', 'rocket_launch', 'home', 'shopping_cart'];
const DEFAULT_WORKSPACE_ICON = 'work';

/**
 * 有效的工作區圖示:已註冊的 icon-id,或短字串(<=4,相容舊版 emoji)。
 * 放寬自原本單純的 length<=4,使新的 icon-id(如 'shopping_cart')不被誤拒;
 * 仍拒絕任意長遠端字串(防濫用)。
 */
function isValidWorkspaceIcon(x) {
    return typeof x === 'string' && (hasIcon(x) || (x.length >= 1 && x.length <= 4));
}

/**
 * 將儲存的工作區圖示解析為可渲染的 HTML:icon-id → Material Symbols SVG;
 * 舊版 emoji(短字串)→ 經跳脫的文字;其餘 → 預設 work 圖示。供管理 dialog 列使用。
 * @param {unknown} stored
 * @param {{size?:number}} [opts]
 * @returns {string}
 */
export function resolveWorkspaceIcon(stored, { size = 16 } = {}) {
    if (typeof stored === 'string' && hasIcon(stored)) return renderIcon(stored, { size });
    if (typeof stored === 'string' && stored.length >= 1 && stored.length <= 4) {
        return `<span class="ws-emoji-icon" aria-hidden="true">${escapeHtml(stored)}</span>`;
    }
    return renderIcon(DEFAULT_WORKSPACE_ICON, { size });
}

/** @type {Object<string, Workspace>} In-memory mirror of storage. */
let workspaces = {};
/** @type {Object<string, string>} windowId → workspaceId. */
let windowWorkspaceMap = {};

export async function initWorkspaces() {
    // ids derive from a sync-area prefix scan. sync is small (settings +
    // per-workspace identity), so get(null) is cheap. NEVER get(null) on
    // LOCAL — custom background images can be MBs.
    const syncAll = await getStorage('sync', null) || {};
    const metaIds = Object.keys(syncAll)
        .filter(k => k.startsWith(WS_META_PREFIX))
        .map(k => k.slice(WS_META_PREFIX.length));

    if (metaIds.length === 0) {
        // No v2 data — either fresh install or pre-v2 storage needing migration.
        await migrateLegacyToV2(syncAll);
        return;
    }

    const snapKeys = metaIds.map(id => WS_SNAP_PREFIX + id);
    const localRes = await getStorage('local', [...snapKeys, WINDOW_WORKSPACE_MAP_KEY]);
    windowWorkspaceMap = localRes[WINDOW_WORKSPACE_MAP_KEY] || {};
    workspaces = {};
    for (const id of metaIds) {
        const meta = syncAll[WS_META_PREFIX + id] || {};
        const snap = localRes[WS_SNAP_PREFIX + id] || {};
        workspaces[id] = {
            ...meta,
            id,
            tabSnapshot: Array.isArray(snap.tabs) ? snap.tabs : [],
            rev: typeof snap.rev === 'number' ? snap.rev : 1,
            updatedAt: typeof snap.updatedAt === 'number' ? snap.updatedAt : (meta.lastActiveAt || Date.now()),
            syncEnabled: typeof meta.syncEnabled === 'boolean' ? meta.syncEnabled : false,
        };
    }
}

/**
 * One-time v1→v2 migration (and the older Phase-6 unified key, collapsed into
 * the same pass). Builds the in-memory mirror either way, so callers never see
 * a half-initialized state.
 *
 * On success the legacy SYNC map is deleted — leaving it would let pre-v2
 * devices keep writing the old key while v2 devices write per-id keys (silent
 * cross-version divergence). Legacy LOCAL keys are kept as cheap backup, same
 * policy as the Phase-9 migration. On write failure everything legacy is kept
 * and the migration retries on next init.
 */
async function migrateLegacyToV2(syncAll) {
    const localRes = await getStorage('local', [
        LEGACY_SNAPSHOTS_KEY, LEGACY_WORKSPACES_KEY, WINDOW_WORKSPACE_MAP_KEY,
    ]);
    windowWorkspaceMap = localRes[WINDOW_WORKSPACE_MAP_KEY] || {};

    const metadata = { ...(syncAll[LEGACY_METADATA_KEY] || {}) };
    const snapshots = { ...(localRes[LEGACY_SNAPSHOTS_KEY] || {}) };
    const phase6 = localRes[LEGACY_WORKSPACES_KEY];
    if (Object.keys(metadata).length === 0 && Object.keys(snapshots).length === 0
        && phase6 && Object.keys(phase6).length > 0) {
        for (const [id, ws] of Object.entries(phase6)) {
            const { tabSnapshot, ...meta } = ws;
            metadata[id] = meta;
            snapshots[id] = tabSnapshot || [];
        }
    }

    workspaces = {};
    if (Object.keys(metadata).length === 0) return; // genuinely fresh install

    const metaItems = {};
    const snapItems = {};
    for (const [id, m] of Object.entries(metadata)) {
        // rev/updatedAt move INTO the local snap record; identity stays in sync.
        const { rev, updatedAt, tabSnapshot: _ignored, ...identity } = m;
        const tabs = Array.isArray(snapshots[id]) ? snapshots[id] : [];
        const metaRec = {
            ...identity,
            id,
            syncEnabled: typeof m.syncEnabled === 'boolean' ? m.syncEnabled : false,
        };
        const snapRec = {
            tabs,
            rev: typeof rev === 'number' ? rev : 1,
            updatedAt: typeof updatedAt === 'number' ? updatedAt : (m.lastActiveAt || Date.now()),
        };
        metaItems[WS_META_PREFIX + id] = metaRec;
        snapItems[WS_SNAP_PREFIX + id] = snapRec;
        workspaces[id] = { ...metaRec, tabSnapshot: tabs, rev: snapRec.rev, updatedAt: snapRec.updatedAt };
    }

    try {
        // Single set() per area = 1 quota op each, regardless of workspace count.
        await Promise.all([
            setStorageStrict('sync', metaItems),
            setStorageStrict('local', snapItems),
        ]);
        await removeStorage('sync', LEGACY_METADATA_KEY);
    } catch (err) {
        // Keep legacy as-is; the in-memory mirror above is already built from
        // legacy data so this session still works. Next init retries.
        console.warn('[workspace] v2 migration write failed, keeping legacy:', err);
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
        icon: isValidWorkspaceIcon(args.icon) ? args.icon : DEFAULT_WORKSPACE_ICON,
        bookmarkFolderId: args.bookmarkFolderId || undefined,
        tabSnapshot: [],
        lastActiveAt: Date.now(),
        rev: 1,
        updatedAt: Date.now(),
        syncEnabled: false,
    };
    if (typeof args.snapshotWindowId === 'number') {
        ws.tabSnapshot = await snapshotWindowTabs(args.snapshotWindowId);
    }
    workspaces[id] = ws;
    await Promise.all([
        persistMetaOnly(id),
        writeSnapRecord(id, { tabs: ws.tabSnapshot, setRev: 1, setUpdatedAt: ws.updatedAt }),
    ]);
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
    if (updates.icon !== undefined && isValidWorkspaceIcon(updates.icon)) ws.icon = updates.icon;
    if (updates.bookmarkFolderId !== undefined) ws.bookmarkFolderId = updates.bookmarkFolderId || undefined;
    // Identity change must reach Drive too → rev bump. bumpRev lives in the
    // snap record write; tabs are deliberately NOT passed so the merge keeps
    // whatever tabs are currently stored (possibly fresher than this mirror).
    await Promise.all([
        persistMetaOnly(id),
        writeSnapRecord(id, { bumpRev: true }),
    ]);
    return ws;
}

/**
 * Toggle whether a workspace participates in Drive sync. This is opt-in INTENT
 * (cross-device via metadata), not a content change — does NOT bump rev.
 * @param {string} id @param {boolean} enabled
 */
export async function setWorkspaceSyncEnabled(id, enabled) {
    const ws = workspaces[id];
    if (!ws) return null;
    ws.syncEnabled = Boolean(enabled);
    await persistMetaOnly(id);
    return ws;
}

/**
 * True if ANY live window is currently bound to this workspace id.
 *
 * Used by the Drive sync engine (via background's isWorkspaceLiveBound dep) to
 * know whether a workspace is materialized into an open window. The engine only
 * ever writes the stored snapshot — it never opens/replaces tabs — so this is an
 * advisory signal, not a guard against destructive ops.
 *
 * @param {string} workspaceId
 * @returns {boolean}
 */
export function isWorkspaceBound(workspaceId) {
    for (const boundId of Object.values(windowWorkspaceMap)) {
        if (boundId === workspaceId) return true;
    }
    return false;
}

/**
 * Apply a workspace pulled from a remote (Drive) into local state WITHOUT
 * opening tabs and WITHOUT bumping rev. The authoritative rev/updatedAt come
 * from the remote payload (this is a downstream apply, not a local edit), so we
 * set them directly rather than calling bumpRev.
 *
 * Two cases:
 *  - Workspace already exists locally → overwrite its identity metadata
 *    (name/color/icon/bookmarkFolderId/syncEnabled), replace its tabSnapshot,
 *    and set rev/updatedAt from the remote.
 *  - Workspace does NOT exist (e.g. restore on a fresh device) → create the
 *    in-memory record with the given id + remote fields. lastActiveAt is seeded
 *    to remote.updatedAt (falling back to now) so the new entry sorts sensibly
 *    in the switcher; it is NOT a window binding (no windows/tabs are touched).
 *
 * NOTE (loop prevention): this persist fires chrome.storage.onChanged. The
 * background onChanged handler must suppress re-enqueuing for engine-initiated
 * writes; that suppression lives in background.js, which records the rev it is
 * about to write into its `engineWriteEcho` map keyed by workspace id (or the
 * string 'deleted' for removals) and consumes the matching onChanged, so this
 * module stays storage-agnostic.
 *
 * @param {string} id
 * @param {{metadata: {name?:string, color?:string, icon?:string, bookmarkFolderId?:string, syncEnabled?:boolean}, tabSnapshot: TabSnapshot[], rev: number, updatedAt?: number}} remote
 * @returns {Promise<Workspace>}
 */
export async function applyRemoteWorkspace(id, { metadata = {}, tabSnapshot = [], rev, updatedAt, keepLocalSnapshot = false } = {}) {
    const remoteUpdatedAt = (typeof updatedAt === 'number')
        ? updatedAt
        : (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : Date.now());
    const existing = workspaces[id];
    if (existing) {
        if (metadata.name !== undefined) existing.name = metadata.name;
        if (metadata.color !== undefined) existing.color = metadata.color;
        // icon 與本機 create/update 一致:僅接受已註冊 icon-id 或短 emoji(<=4),防止損毀/
        // 惡意的遠端資料帶入超長字串,污染各處圖示渲染(workspace 標籤、Spotlight 結果列)。
        if (metadata.icon !== undefined && isValidWorkspaceIcon(metadata.icon)) existing.icon = metadata.icon;
        // bookmarkFolderId is intentionally allowed to be cleared (undefined).
        existing.bookmarkFolderId = metadata.bookmarkFolderId || undefined;
        if (metadata.syncEnabled !== undefined) existing.syncEnabled = Boolean(metadata.syncEnabled);
        // F3 (ISSUE-162): when the workspace is live-bound on THIS device, its
        // tabSnapshot is owned by the live window — applying the remote copy
        // would be overwritten by the next auto-snapshot and ping-pong revs
        // across devices forever. Keep local tabs but ADOPT the remote
        // rev/updatedAt (ordering authority), so the next genuine local change
        // bumps PAST the remote rev and pushes local content legitimately.
        await Promise.all([
            persistMetaOnly(id),
            writeSnapRecord(id, keepLocalSnapshot
                ? { setRev: rev, setUpdatedAt: remoteUpdatedAt } // tabs merged from stored (= freshest local)
                : { tabs: Array.isArray(tabSnapshot) ? tabSnapshot : [], setRev: rev, setUpdatedAt: remoteUpdatedAt }),
        ]);
    } else {
        workspaces[id] = {
            id,
            name: metadata.name || 'Workspace',
            color: metadata.color || 'blue',
            icon: isValidWorkspaceIcon(metadata.icon) ? metadata.icon : DEFAULT_WORKSPACE_ICON,
            bookmarkFolderId: metadata.bookmarkFolderId || undefined,
            tabSnapshot: Array.isArray(tabSnapshot) ? tabSnapshot : [],
            lastActiveAt: remoteUpdatedAt,
            rev: typeof rev === 'number' ? rev : 1,
            updatedAt: remoteUpdatedAt,
            syncEnabled: metadata.syncEnabled !== undefined ? Boolean(metadata.syncEnabled) : true,
        };
        await Promise.all([
            persistMetaOnly(id),
            writeSnapRecord(id, {
                tabs: workspaces[id].tabSnapshot,
                setRev: workspaces[id].rev,
                setUpdatedAt: remoteUpdatedAt,
            }),
        ]);
    }
    return workspaces[id];
}

export async function deleteWorkspace(id) {
    delete workspaces[id];
    await Promise.all([
        removePersisted(id),
        // Detach any window currently bound to it.
        mutateWindowMap(map => {
            let changed = false;
            for (const wid of Object.keys(map)) {
                if (map[wid] === id) {
                    delete map[wid];
                    changed = true;
                }
            }
            return changed;
        }),
    ]);
}

/**
 * Replaces the workspace's tabSnapshot with the current state of `windowId`.
 * Pinned tabs are kept; chrome:// / about: pages are filtered out (see
 * buildSnapshotFromTabs), so they are NOT part of a workspace.
 * @param {string} id
 * @param {number} windowId
 */
export async function snapshotIntoWorkspace(id, windowId) {
    const ws = workspaces[id];
    if (!ws) return null;
    const snap = await snapshotWindowTabs(windowId);
    // Never wipe a non-empty snapshot with an empty one from this path: an
    // all-chrome:// window legitimately yields [], but so does a window in
    // mid-teardown (tabs already gone) — and the background auto-snapshot
    // can race window close. Keeping the stale snapshot is strictly safer.
    if (snap.length === 0 && (ws.tabSnapshot || []).length > 0) return ws;
    // Content-equality skip: many tab events reach the debounce without
    // changing what we persist (reloads, group churn that resolves back).
    // Skipping identical snapshots avoids a spurious rev bump (= a needless
    // Drive push).
    if (JSON.stringify(snap) === JSON.stringify(ws.tabSnapshot)) return ws;
    // FR-02: snapshots write ONLY the local snap record — no sync-area write,
    // and no lastActiveAt bump (a background snapshot is not user activity;
    // it must not reorder the switcher nor consume sync quota).
    await writeSnapRecord(id, { tabs: snap, bumpRev: true });
    return ws;
}

/**
 * Bind/unbind a window to a workspace.
 * Single-binding invariant (FR-06): binding a workspace to one window removes
 * any other window's binding to the SAME workspace — two live windows feeding
 * snapshots into one workspace would oscillate its content on every event.
 * @param {number} windowId
 * @param {string|null} workspaceId
 * @param {{touch?: boolean}} [opts] - touch=false skips the lastActiveAt bump
 *   (used by startup re-binding, which must not scramble the switcher's
 *   recency order).
 */
export async function setActiveWorkspace(windowId, workspaceId, { touch = true } = {}) {
    const wid = String(windowId);
    if (workspaceId === null || workspaceId === undefined) {
        await mutateWindowMap(map => {
            if (!(wid in map)) return false;
            delete map[wid];
            return true;
        });
        return;
    }
    await mutateWindowMap(map => {
        for (const w of Object.keys(map)) {
            if (map[w] === workspaceId && w !== wid) delete map[w];
        }
        map[wid] = workspaceId;
        return true;
    });
    const ws = workspaces[workspaceId];
    if (ws && touch) {
        ws.lastActiveAt = Date.now();
        await persistMetaOnly(workspaceId);
    }
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
 * First live window currently bound to `workspaceId`, or null. Verifies the
 * window actually exists; stale entries found along the way are dropped
 * (Chrome recycles window ids across sessions).
 * @param {string} workspaceId
 * @returns {Promise<number|null>}
 */
export async function findLiveWindowForWorkspace(workspaceId) {
    const staleWids = [];
    let found = null;
    for (const [wid, boundId] of Object.entries(windowWorkspaceMap)) {
        if (boundId !== workspaceId) continue;
        const id = Number(wid);
        const win = await chrome.windows.get(id).catch(() => null);
        if (win && found === null) {
            found = id;
        } else if (!win) {
            staleWids.push(wid);
        }
    }
    if (staleWids.length > 0) {
        await mutateWindowMap(map => {
            let changed = false;
            for (const wid of staleWids) {
                if (map[wid] === workspaceId) {
                    delete map[wid];
                    changed = true;
                }
            }
            return changed;
        });
    }
    return found;
}

/**
 * Arc-style switch: bring the target workspace's window to the front, opening
 * one if needed. NON-DESTRUCTIVE — the window the request came from keeps its
 * tabs and its own binding.
 *
 *  - Target already bound to a live window → focus that window.
 *  - Otherwise → open a NEW window restoring the target's snapshot (tab groups
 *    rebuilt best-effort) and bind it to the workspace.
 *
 * The previous hibernate-in-place semantics (close the current window's tabs,
 * reopen the snapshot in the same window) was the main tab-loss vector: any
 * staleness in either snapshot destroyed live tabs. With one-window-per-
 * workspace, switching cannot lose tabs by construction; live windows are
 * continuously snapshotted by the background lifecycle module, so closing a
 * workspace window is also safe.
 *
 * @param {string} targetId
 * @param {number} [originWindowId] - the window the request came from; only
 *   used to skip the redundant focus call when it is already the target's.
 * @returns {Promise<{action:'focused'|'opened', windowId:number}|false>}
 *   false if the workspace does not exist.
 */
export async function switchWorkspace(targetId, originWindowId) {
    const target = workspaces[targetId];
    if (!target) return false;

    const boundWindowId = await findLiveWindowForWorkspace(targetId);
    if (boundWindowId !== null) {
        if (boundWindowId !== originWindowId) {
            try {
                await chrome.windows.update(boundWindowId, { focused: true });
            } catch (err) {
                console.warn('[workspace] focus failed', err);
            }
        }
        target.lastActiveAt = Date.now();
        await persistMetaOnly(targetId);
        return { action: 'focused', windowId: boundWindowId };
    }

    const snapshotTabs = (target.tabSnapshot && target.tabSnapshot.length > 0)
        ? target.tabSnapshot
        : [{ url: 'chrome://newtab/', title: '', pinned: false }];

    // The window is created with the first tab only; the rest are added
    // sequentially so a per-tab failure (e.g. revoked file:// access) skips
    // just that tab, and the snapshot order is preserved. ~30ms/tab × 30 tabs
    // ≈ 1s worst case, acceptable for an explicit user action.
    const createdTabIds = [];
    let win;
    try {
        win = await chrome.windows.create({ url: snapshotTabs[0].url, focused: true });
        createdTabIds.push(win.tabs && win.tabs[0] ? win.tabs[0].id : null);
    } catch (err) {
        console.warn('[workspace] failed to open window with first tab, using blank window', snapshotTabs[0].url, err);
        win = await chrome.windows.create({ focused: true });
        createdTabIds.push(null);
    }
    const windowId = win.id;

    for (let i = 1; i < snapshotTabs.length; i++) {
        const s = snapshotTabs[i];
        try {
            const newTab = await chrome.tabs.create({ windowId, url: s.url, active: false });
            createdTabIds.push(newTab.id);
        } catch (err) {
            createdTabIds.push(null);
            console.warn('[workspace] failed to restore tab', s.url, err);
        }
    }

    // Pin after all tabs exist: pinned tabs auto-move to the front, and the
    // snapshot lists pinned entries first, so order is preserved.
    for (let i = 0; i < snapshotTabs.length; i++) {
        if (snapshotTabs[i].pinned && createdTabIds[i] != null) {
            try {
                await chrome.tabs.update(createdTabIds[i], { pinned: true });
            } catch (err) {
                console.warn('[workspace] failed to pin restored tab', err);
            }
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
    return { action: 'opened', windowId };
}

/**
 * Removes window→workspace entries for windows that no longer exist.
 * Called on init to clean up ephemeral ids that pile up across sessions.
 */
export async function pruneWindowWorkspaceMap() {
    const allWindows = await chrome.windows.getAll().catch(() => []);
    const aliveIds = new Set(allWindows.map(w => String(w.id)));
    await mutateWindowMap(map => {
        let changed = false;
        for (const wid of Object.keys(map)) {
            if (!aliveIds.has(wid)) {
                delete map[wid];
                changed = true;
            }
        }
        return changed;
    });
}

/**
 * Normalize a URL for snapshot matching: drop the #fragment. SPAs and anchor
 * navigation churn the fragment without changing what page the tab "is",
 * which would otherwise erode the similarity score across a restart.
 * Pure function.
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrlForMatch(url) {
    if (typeof url !== 'string') return '';
    const i = url.indexOf('#');
    return i === -1 ? url : url.slice(0, i);
}

/**
 * Similarity ∈ [0,1] between two URL lists: multiset intersection size divided
 * by the LARGER list's size. Max (not min) keeps the score honest when one
 * side is a superset — a 2-tab window should not perfectly match a 30-tab
 * workspace just because both tabs appear in it. Pure function.
 * @param {string[]} urlsA
 * @param {string[]} urlsB
 * @returns {number}
 */
export function scoreSnapshotSimilarity(urlsA, urlsB) {
    if (!Array.isArray(urlsA) || !Array.isArray(urlsB) || urlsA.length === 0 || urlsB.length === 0) return 0;
    const counts = new Map();
    for (const u of urlsA) {
        const k = normalizeUrlForMatch(u);
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    let common = 0;
    for (const u of urlsB) {
        const k = normalizeUrlForMatch(u);
        const c = counts.get(k) || 0;
        if (c > 0) {
            common++;
            counts.set(k, c - 1);
        }
    }
    return common / Math.max(urlsA.length, urlsB.length);
}

/**
 * Greedy 1:1 assignment of windows to workspaces by snapshot similarity.
 * Used by the background lifecycle module to re-identify session-restored
 * windows after a browser restart. Pure function.
 *
 * Ambiguity guard (ISSUE-162 F2/FR-03): a window only contributes its single
 * BEST candidate, and only when that score leads the runner-up by `margin`.
 * A misbind is DESTRUCTIVE here — the next auto-snapshot would overwrite the
 * wrong workspace's content (and push it to Drive) — so two template-similar
 * workspaces scoring close (incl. exact ties at 1.0) bind NOTHING and leave
 * the choice to the user.
 *
 * @param {Array<{windowId:number, urls:string[]}>} windows
 * @param {Array<{id:string, urls:string[]}>} candidates
 * @param {{threshold?:number, margin?:number}} [opts]
 *   threshold: minimum score to accept (default 0.6)
 *   margin: required lead of best over second-best per window (default 0.15)
 * @returns {Array<{windowId:number, workspaceId:string, score:number}>}
 */
export function matchWindowsToWorkspaces(windows, candidates, { threshold = 0.6, margin = 0.15 } = {}) {
    const pairs = [];
    for (const w of windows || []) {
        const scored = [];
        for (const c of candidates || []) {
            const score = scoreSnapshotSimilarity(w.urls, c.urls);
            if (score >= threshold) scored.push({ windowId: w.windowId, workspaceId: c.id, score });
        }
        if (scored.length === 0) continue;
        scored.sort((a, b) => b.score - a.score);
        if (scored.length >= 2 && scored[0].score - scored[1].score < margin) continue;
        pairs.push(scored[0]);
    }
    pairs.sort((a, b) => b.score - a.score);
    const usedWindows = new Set();
    const usedWorkspaces = new Set();
    const result = [];
    for (const p of pairs) {
        if (usedWindows.has(p.windowId) || usedWorkspaces.has(p.workspaceId)) continue;
        usedWindows.add(p.windowId);
        usedWorkspaces.add(p.workspaceId);
        result.push(p);
    }
    return result;
}

/**
 * Per-id persistence (ISSUE-162 WP1 / FR-01).
 *
 * Field ownership:
 *   wsMeta_<id> (sync):  identity + lastActiveAt — written by user actions
 *                        (create/rename/sync-toggle/switch), never by the
 *                        auto-snapshot path (FR-02 quota protection).
 *   wsSnap_<id> (local): tabs + rev + updatedAt — written via writeSnapRecord's
 *                        read→merge→write so a stale mirror can't clobber the
 *                        fields another context just wrote (e.g. a sidepanel
 *                        rename bumping rev must NOT revert the background's
 *                        fresher tabs — it merges them in instead).
 */

/** sync-area identity record for one workspace (from the in-memory mirror). */
function buildMetaRecord(ws) {
    return {
        id: ws.id,
        name: ws.name,
        color: ws.color,
        icon: ws.icon,
        bookmarkFolderId: ws.bookmarkFolderId,
        syncEnabled: Boolean(ws.syncEnabled),
        lastActiveAt: ws.lastActiveAt,
    };
}

/** Persist one workspace's identity to sync. Quota failure logs loudly, never throws. */
function persistMetaOnly(id) {
    const ws = workspaces[id];
    if (!ws) return Promise.resolve();
    return setStorageStrict('sync', { [WS_META_PREFIX + id]: buildMetaRecord(ws) })
        .catch(err => {
            console.warn('[workspace] sync meta write failed (sync disabled or quota). '
                + 'Local data intact; cross-device identity is stale:', err);
        });
}

/**
 * Persist one workspace's content record with read→merge→write semantics —
 * the caller only overwrites the fields it owns:
 *   { tabs }                — replace tabs (auto-snapshot path)
 *   { bumpRev: true }       — rev = max(stored, mirror) + 1 (content change);
 *                             max() absorbs concurrent bumps from the other
 *                             context so two writers can't mint the same rev
 *                             for different content (F4 surface reduction)
 *   { setRev, setUpdatedAt }— adopt authoritative values (Drive pull apply)
 * Omitted fields are taken from the STORED record (the other context may have
 * fresher data than this mirror), falling back to the mirror.
 * Also refreshes the in-memory mirror to the merged result.
 */
async function writeSnapRecord(id, opts = {}) {
    const ws = workspaces[id];
    if (!ws) return null;
    const key = WS_SNAP_PREFIX + id;
    const cur = (await getStorage('local', [key]))[key] || {};
    const curTabs = Array.isArray(cur.tabs) ? cur.tabs : null;
    const curRev = typeof cur.rev === 'number' ? cur.rev : 0;

    const tabs = opts.tabs !== undefined
        ? opts.tabs
        : (curTabs !== null ? curTabs : (ws.tabSnapshot || []));
    let rev, updatedAt;
    if (typeof opts.setRev === 'number') {
        rev = opts.setRev;
        updatedAt = typeof opts.setUpdatedAt === 'number' ? opts.setUpdatedAt : Date.now();
    } else if (opts.bumpRev) {
        rev = Math.max(curRev, ws.rev || 0) + 1;
        updatedAt = Date.now();
    } else {
        rev = Math.max(curRev, ws.rev || 1);
        updatedAt = typeof cur.updatedAt === 'number' ? cur.updatedAt : (ws.updatedAt || Date.now());
    }

    ws.tabSnapshot = tabs;
    ws.rev = rev;
    ws.updatedAt = updatedAt;
    await setStorage('local', { [key]: { tabs, rev, updatedAt } });
    return ws;
}

/** Remove one workspace's persisted records (both areas). */
function removePersisted(id) {
    return Promise.all([
        removeStorage('sync', WS_META_PREFIX + id),
        removeStorage('local', WS_SNAP_PREFIX + id),
    ]);
}

/**
 * Apply a delta to windowWorkspaceMap with read→merge→write.
 *
 * NEVER persist the in-memory map wholesale: between a mutation and its
 * persist there are awaits, and the debounced storage.onChanged reload
 * (initWorkspaces) can swap the module-level map for a stale storage copy in
 * that window — a wholesale persist would then faithfully write the STALE map
 * and erase bindings other code (or the other context) just made. Caught live
 * by the workspace E2E. The mutator receives the freshly-READ stored map and
 * returns true if it changed anything; the merged result becomes both the
 * stored and the in-memory map.
 *
 * @param {(map: Object<string,string>) => boolean} mutator
 */
async function mutateWindowMap(mutator) {
    const res = await getStorage('local', [WINDOW_WORKSPACE_MAP_KEY]);
    const map = res[WINDOW_WORKSPACE_MAP_KEY] || {};
    const changed = mutator(map);
    windowWorkspaceMap = map;
    if (changed) await setStorage('local', { [WINDOW_WORKSPACE_MAP_KEY]: map });
}
