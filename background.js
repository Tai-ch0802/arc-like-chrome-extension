// background.js

import { handleAlarm as handleRssAlarm } from './modules/rssManager.js';
import { generateGroupName } from './modules/aiManager.js';
import { getStorage, setStorage } from './modules/apiManager.js';
import * as workspaceManager from './modules/workspace/workspaceManager.js';
import { createSyncEngine } from './modules/sync/syncEngine.js';
import { removedSyncedIds } from './modules/sync/syncLogic.js';
import { createGoogleDriveProvider } from './modules/sync/googleDriveProvider.js';
import * as driveAuth from './modules/sync/driveAuth.js';

const AI_AUTO_NAMING_KEY = 'aiAutoNamingEnabled';

// ---------------------------------------------------------------------------
// Drive sync wiring (E3b)
// ---------------------------------------------------------------------------
//
// This block wires the (already-built, tested) sync engine into the service
// worker with REAL deps: GoogleDriveProvider for I/O, workspaceManager for
// local state, and chrome.storage.local for the engine's queue / baseRev /
// restorable / status surfaces.
//
// Inert-when-not-connected: GoogleDriveProvider.isConnected() delegates to
// driveAuth.isConnected(), which returns false whenever no OAuth token can be
// obtained non-interactively (the default while manifest.json carries the
// placeholder client_id). Every engine entry point guards on isConnected()
// first, so with no token the engine returns early and nothing throws.

// Storage keys owned by the sync layer (all chrome.storage.local).
const DRIVE_DEVICE_ID_KEY = 'driveDeviceId';
const DRIVE_BASE_REV_KEY = 'driveBaseRev';       // { [workspaceId]: rev }
const DRIVE_SYNC_QUEUE_KEY = 'driveSyncQueue';   // Array<{type, workspaceId}>
const DRIVE_RESTORABLE_KEY = 'driveRestorable';  // Array<{id, rev, metadata}>
const DRIVE_SYNC_STATUS_KEY = 'driveSyncStatus'; // SyncStatus

// Workspace storage keys (mirrors workspaceManager) — used to diff onChanged.
const WORKSPACE_METADATA_KEY = 'workspaceMetadata';     // chrome.storage.sync
const WORKSPACE_SNAPSHOTS_KEY = 'workspaceSnapshots';   // chrome.storage.local

// Alarm names.
const ALARM_PULL = 'driveSyncPull';     // periodic full runOnce
const ALARM_FLUSH = 'driveSyncFlush';   // one-shot debounced push flush
const PULL_PERIOD_MIN = 10;             // ~10 min periodic pull
const FLUSH_DEBOUNCE_MIN = 0.14;        // ~8.4s one-shot debounce (chrome.alarms min granularity)

/**
 * Loop-suppression echo map. When an ENGINE-INITIATED write touches local
 * workspace state (applyRemoteSnapshot / removeLocalWorkspace), it fires
 * chrome.storage.onChanged like any other write. Without a guard the onChanged
 * handler below would re-enqueue a push for the very workspace we just pulled,
 * causing a pull→push→pull loop.
 *
 * A module boolean cleared in finally() is racy: chrome.storage.onChanged for
 * the engine's write is typically delivered in a LATER task — after the flag is
 * already cleared — so the handler never sees the suppression. Instead we record
 * the exact rev the engine wrote (or the string 'deleted' for removals) keyed by
 * workspace id. The onChanged handler consumes the entry by comparing it against
 * the workspace's NEW rev: a match means engine-initiated → skip + delete the
 * entry; a mismatch (or no entry) means a genuine user edit → enqueue.
 *
 * We own the suppression HERE (not in workspaceManager) so the manager stays
 * storage-agnostic. The map self-bounds: per-id set overwrites, and entries are
 * deleted on consumption. A lingering entry only occurs if onChanged never
 * arrives for a write (rare); it self-heals on the next engine write to that id.
 */
const engineWriteEcho = new Map(); // workspaceId -> rev the engine just wrote (or the string 'deleted')

/** In-memory device-id cache (avoids a storage read per buildPushPayload). */
let cachedDeviceId = null;

/** Has workspaceManager been initialized in this SW lifetime? */
let workspaceInitDone = false;

/** Ensure workspaceManager's in-memory mirror is populated in the SW context. */
async function ensureWorkspacesInit() {
    if (workspaceInitDone) return;
    await workspaceManager.initWorkspaces();
    workspaceInitDone = true;
}

/** Stable per-install device id. Generated + persisted on first use, then cached. */
async function getDeviceId() {
    if (cachedDeviceId) return cachedDeviceId;
    const res = await getStorage('local', [DRIVE_DEVICE_ID_KEY]);
    let id = res[DRIVE_DEVICE_ID_KEY];
    if (!id) {
        id = crypto.randomUUID();
        await setStorage('local', { [DRIVE_DEVICE_ID_KEY]: id });
    }
    cachedDeviceId = id;
    return id;
}

const syncProvider = createGoogleDriveProvider();

const syncEngine = createSyncEngine({
    provider: syncProvider,

    // getDeviceId is called synchronously inside buildPushPayload, so it must
    // return a string. We prime cachedDeviceId via ensureDeviceId() before any
    // runOnce/flush so the synchronous read always hits the cache.
    getDeviceId: () => cachedDeviceId || '',

    now: () => Date.now(),

    /**
     * ALL syncEnabled local workspaces, mapped to the engine's shape. The engine
     * filters to syncEnabled itself, but we pre-filter here too (cheaper, and
     * the contract only asks for synced ones to participate).
     */
    async listLocalWorkspaces() {
        await ensureWorkspacesInit();
        return workspaceManager.getAllWorkspaces()
            .filter((w) => w.syncEnabled)
            .map((w) => ({
                id: w.id,
                rev: w.rev,
                syncEnabled: w.syncEnabled,
                metadata: {
                    name: w.name,
                    color: w.color,
                    icon: w.icon,
                    bookmarkFolderId: w.bookmarkFolderId,
                    syncEnabled: w.syncEnabled,
                },
                tabSnapshot: w.tabSnapshot,
            }));
    },

    async getBaseRev(id) {
        const res = await getStorage('local', [DRIVE_BASE_REV_KEY]);
        const map = res[DRIVE_BASE_REV_KEY] || {};
        return map[id] || 0;
    },

    async setBaseRev(id, rev) {
        const res = await getStorage('local', [DRIVE_BASE_REV_KEY]);
        const map = res[DRIVE_BASE_REV_KEY] || {};
        map[id] = rev;
        await setStorage('local', { [DRIVE_BASE_REV_KEY]: map });
    },

    /**
     * Write a pulled file json into local state WITHOUT opening tabs. We record
     * the rev being written into engineWriteEcho BEFORE the persist so the
     * (later-delivered) onChanged for this engine-initiated write is recognized
     * by the handler and does not bounce back as a push. applyRemoteWorkspace
     * sets the workspace's rev to fileJson.rev, so the handler's new-rev compare
     * will match this echo entry exactly.
     */
    async applyRemoteSnapshot(id, fileJson) {
        await ensureWorkspacesInit();
        engineWriteEcho.set(id, fileJson.rev);
        await workspaceManager.applyRemoteWorkspace(id, {
            metadata: fileJson.metadata,
            tabSnapshot: fileJson.tabSnapshot,
            rev: fileJson.rev,
            updatedAt: fileJson.updatedAt,
        });
    },

    async removeLocalWorkspace(id) {
        await ensureWorkspacesInit();
        engineWriteEcho.set(id, 'deleted');
        await workspaceManager.deleteWorkspace(id);
    },

    async isWorkspaceLiveBound(id) {
        await ensureWorkspacesInit();
        return workspaceManager.isWorkspaceBound(id);
    },

    async readQueue() {
        const res = await getStorage('local', [DRIVE_SYNC_QUEUE_KEY]);
        return res[DRIVE_SYNC_QUEUE_KEY] || [];
    },

    async writeQueue(ops) {
        await setStorage('local', { [DRIVE_SYNC_QUEUE_KEY]: ops });
    },

    async setRestorable(list) {
        await setStorage('local', { [DRIVE_RESTORABLE_KEY]: list });
    },

    async setStatus(status) {
        await setStorage('local', { [DRIVE_SYNC_STATUS_KEY]: status });
    },
});

/**
 * Prime the cached device id (so getDeviceId() returns synchronously inside the
 * engine) and then run a full sync cycle.
 *
 * Offline vs needs-auth (E3a Minor): a NETWORK failure should surface as
 * 'offline', not 'needs-auth'. We can't cleanly distinguish those inside the
 * pure engine, so we short-circuit here: if the device is offline, set the
 * offline status and skip the cycle entirely. When online, the engine's own
 * guards set 'needs-auth' iff there's genuinely no token.
 */
async function runSyncOnce() {
    try {
        // Inert-when-never-connected (I2): if no OAuth token can be obtained
        // (the default while manifest.json carries the placeholder client_id),
        // skip the WHOLE cycle WITHOUT writing any status. runOnce() would
        // otherwise write 'syncing' then 'needs-auth', causing storage churn and
        // a "Syncing…" badge flicker on every alarm for an install that has
        // never connected Drive. We early-return here BEFORE any status write.
        if (!(await syncProvider.isConnected())) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            await setStorage('local', { [DRIVE_SYNC_STATUS_KEY]: { state: 'offline' } });
            return;
        }
        await getDeviceId(); // prime cache for synchronous getDeviceId() in engine
        await ensureWorkspacesInit();
        await syncEngine.runOnce();
    } catch (err) {
        // The engine sets its own terminal status on provider errors; this catch
        // is a last-resort guard so an unexpected throw never crashes the SW.
        console.warn('[sync] runOnce failed:', err && err.message ? err.message : err);
    }
}

/** (Re)create the periodic pull alarm. Alarms don't survive a browser restart. */
function ensurePullAlarm() {
    chrome.alarms.create(ALARM_PULL, { periodInMinutes: PULL_PERIOD_MIN });
}

// Recreate the periodic alarm at the TOP of every SW startup (cold start after
// termination, browser restart, etc.). chrome.alarms.create with the same name
// is idempotent — it just resets the schedule.
ensurePullAlarm();

/**
 * Diff two id→value maps and return the set of ids whose value changed, was
 * added, or was removed.
 * @param {Object} oldMap
 * @param {Object} newMap
 * @returns {Set<string>}
 */
function changedIds(oldMap, newMap) {
    const ids = new Set();
    const o = oldMap || {};
    const n = newMap || {};
    for (const id of new Set([...Object.keys(o), ...Object.keys(n)])) {
        if (JSON.stringify(o[id]) !== JSON.stringify(n[id])) ids.add(id);
    }
    return ids;
}

/** Read one workspace's persisted base rev (same storage the engine deps use). */
async function readBaseRev(id) {
    const res = await getStorage('local', [DRIVE_BASE_REV_KEY]);
    const map = res[DRIVE_BASE_REV_KEY] || {};
    return map[id] || 0;
}

/**
 * onChanged → enqueue pushes for changed synced workspaces + schedule a debounced
 * flush.
 *
 * Engine-write suppression is timing-independent via engineWriteEcho (see its
 * declaration): for each changed id we compare the workspace's NEW rev against
 * the recorded echo. A match (or 'deleted' for a removed id) means the change was
 * engine-initiated → skip enqueue AND delete the echo entry, so a genuine future
 * user edit landing at the same rev is not wrongly suppressed. No entry / a
 * mismatch means a real user edit → enqueue. A defensive rev>baseRev guard then
 * skips ids already in sync (nothing to push), avoiding wasted flushes.
 */
async function handleWorkspaceStorageChange(changes, areaName) {
    let ids = new Set();
    if (areaName === 'sync' && changes[WORKSPACE_METADATA_KEY]) {
        const c = changes[WORKSPACE_METADATA_KEY];
        ids = changedIds(c.oldValue, c.newValue);

        // Soft-delete tombstone wiring (C1): a synced workspace whose metadata
        // entry vanished from chrome.storage.sync was DELETED by the user. We
        // must tombstone its Drive file so the deletion propagates to other
        // devices (otherwise it resurrects as "restorable"). Disabling a
        // workspace's sync (still present, syncEnabled→false) is NOT a delete
        // and is excluded by removedSyncedIds.
        //
        // Echo guard: an ENGINE-initiated remove (pull-driven delete-local) sets
        // engineWriteEcho.set(id, 'deleted'). For such ids we consume the echo
        // and SKIP enqueueDelete — the engine removed it because of a REMOTE
        // tombstone, so re-tombstoning here would be redundant/looping. A genuine
        // user delete has no echo → enqueueDelete proceeds.
        let deleteEnqueued = false;
        for (const id of removedSyncedIds(c.oldValue || {}, c.newValue || {})) {
            if (engineWriteEcho.get(id) === 'deleted') {
                engineWriteEcho.delete(id);
                continue;
            }
            await syncEngine.enqueueDelete(id);
            deleteEnqueued = true;
        }
        if (deleteEnqueued) {
            chrome.alarms.create(ALARM_FLUSH, { delayInMinutes: FLUSH_DEBOUNCE_MIN });
        }
    } else if (areaName === 'local' && changes[WORKSPACE_SNAPSHOTS_KEY]) {
        const c = changes[WORKSPACE_SNAPSHOTS_KEY];
        ids = changedIds(c.oldValue, c.newValue);
    } else {
        return;
    }
    if (ids.size === 0) return;

    // Re-read storage into the SW's in-memory mirror. The mutating write almost
    // always comes from ANOTHER context (the sidepanel), so the SW's mirror is
    // stale; re-initializing makes the syncEnabled filter + rev reads below
    // reflect the authoritative just-changed state rather than a stale snapshot.
    await workspaceManager.initWorkspaces();
    workspaceInitDone = true;

    let enqueued = false;
    for (const id of ids) {
        const ws = workspaceManager.getWorkspace(id);

        // Engine-write echo: a removed id whose echo is 'deleted', or a present
        // id whose new rev equals the echoed rev, is an engine-initiated write.
        // Consume (delete) the entry and skip enqueue.
        if (engineWriteEcho.has(id)) {
            const echoed = engineWriteEcho.get(id);
            const isEngineWrite = ws
                ? echoed === ws.rev
                : echoed === 'deleted';
            if (isEngineWrite) {
                engineWriteEcho.delete(id);
                continue;
            }
        }

        // Only enqueue workspaces the user has opted into syncing. A changed id
        // no longer a synced workspace (deleted, or sync turned off) is ignored
        // here; deletes are handled explicitly via driveSetWorkspaceSync.
        if (!ws || !ws.syncEnabled) continue;

        // Defensive no-op avoidance: a workspace already in sync (rev <= baseRev)
        // has nothing to push, so skip it rather than enqueue a no-op flush.
        if (ws.rev > await readBaseRev(id)) {
            await syncEngine.enqueuePush(id);
            enqueued = true;
        }
    }
    if (enqueued) {
        // Debounced one-shot flush: recreating the alarm pushes its fire time
        // out, so a burst of changes collapses into a single flush.
        chrome.alarms.create(ALARM_FLUSH, { delayInMinutes: FLUSH_DEBOUNCE_MIN });
    }
}

// 監聽快捷鍵指令
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'create-new-tab-right') {
    // 查詢當前作用中的分頁
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTab) {
      const newTab = await chrome.tabs.create({
        index: currentTab.index + 1,
        active: true
      });
      // 如果當前分頁在群組中，也將新分頁加入同一個群組
      if (currentTab.groupId > 0) {
        await chrome.tabs.group({
          groupId: currentTab.groupId,
          tabIds: newTab.id
        });
      }
    }
  }
});

// 首次安裝擴充功能時執行的程式碼
chrome.runtime.onInstalled.addListener(() => {
  // 這個設定會告訴瀏覽器，當使用者點擊工具列圖示「或觸發 _execute_action 指令」時，
  // 自動開關側邊欄。
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
  // (Re)create the periodic pull alarm on install/update as well as cold start.
  ensurePullAlarm();
});

// onStartup (browser launch): alarms may have been cleared, so recreate the
// periodic pull alarm and run one immediate sync cycle.
chrome.runtime.onStartup.addListener(() => {
  ensurePullAlarm();
  runSyncOnce();
});

// 監聯 RSS 定時抓取鬧鐘 + Drive 同步鬧鐘（單一 onAlarm 監聽器分派）
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_PULL) {
    runSyncOnce();
    return;
  }
  if (alarm.name === ALARM_FLUSH) {
    // Debounced push flush. Guard offline the same way as runOnce so a flush
    // while offline doesn't get misclassified as needs-auth.
    (async () => {
      try {
        // Inert guard (I2): never-connected installs skip the flush WITHOUT a
        // status write (flushQueue would otherwise set 'needs-auth' status churn).
        if (!(await syncProvider.isConnected())) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          await setStorage('local', { [DRIVE_SYNC_STATUS_KEY]: { state: 'offline' } });
          return;
        }
        await getDeviceId();
        await ensureWorkspacesInit();
        await syncEngine.flushQueue();
      } catch (err) {
        console.warn('[sync] flush failed:', err && err.message ? err.message : err);
      }
    })();
    return;
  }
  // Anything else → RSS.
  handleRssAlarm(alarm);
});

// chrome.storage.onChanged → derive sync pushes for changed workspaces.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' && areaName !== 'local') return;
  handleWorkspaceStorageChange(changes, areaName).catch((err) => {
    console.warn('[sync] onChanged handling failed:', err && err.message ? err.message : err);
  });
});

// AI Auto Group Naming: 當使用者建立一個空白名稱的新群組時，由 background
// 統一處理避免多 sidepanel 重複觸發。generateGroupName 內部已限制只在
// model === 'available' 時執行（不會 silent kick off model download）。
chrome.tabGroups.onCreated.addListener(async (group) => {
    try {
        if (group.title && group.title.trim()) return; // user provided a title

        const settings = await chrome.storage.sync.get([AI_AUTO_NAMING_KEY]);
        if (settings[AI_AUTO_NAMING_KEY] === false) return; // disabled by user

        // Two reasons for an 800ms delay before querying tabs:
        // 1. onCreated fires before Chrome finishes binding the dragged tabs'
        //    groupId, so an immediate chrome.tabs.query would return [].
        // 2. Gives the user a window to start typing a manual title in Chrome's
        //    title-input popover. We can't detect input-focus on a group title
        //    (no API for it), so a delay is the only mitigation against
        //    overwriting in-progress typing.
        await new Promise(resolve => setTimeout(resolve, 800));

        const tabs = await chrome.tabs.query({ groupId: group.id });
        if (!tabs || tabs.length === 0) return;

        const label = await generateGroupName(tabs.map(t => ({ title: t.title, url: t.url })));
        if (!label) return;

        // Re-check before writing: the user may have typed a title while
        // the AI request was in flight. Don't clobber human input.
        const current = await chrome.tabGroups.get(group.id);
        if (current.title && current.title.trim()) return;

        await chrome.tabGroups.update(group.id, { title: label });
    } catch (err) {
        // Group may have been removed, or AI call may have failed.
        // Naming is best-effort by design (PRD FR-1.06 silent skip).
        console.warn('[AI naming] skipped:', err && err.message ? err.message : err);
    }
});

// 監聽來自側邊面板的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openShortcutsPage') {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    return false;
  } else if (message.action === 'openAppearanceSettingsPage') {
    chrome.tabs.create({ url: 'chrome://settings/appearance' });
    return false;
  } else if (message.action === 'driveSyncNow') {
    // Manual "Sync now".
    (async () => {
      await runSyncOnce();
      sendResponse({ ok: true });
    })().catch((err) => sendResponse({ ok: false, error: err && err.message }));
    return true;
  } else if (message.action === 'driveConnect') {
    // Interactive connect (must be triggered from a user gesture in options UI),
    // then run an immediate sync cycle.
    (async () => {
      const connected = await driveAuth.connect();
      if (connected) await runSyncOnce();
      sendResponse({ ok: connected });
    })().catch((err) => sendResponse({ ok: false, error: err && err.message }));
    return true;
  } else if (message.action === 'driveDisconnect') {
    (async () => {
      await driveAuth.disconnect();
      // Clear sync surfaces so the UI doesn't show stale connected state.
      await setStorage('local', {
        [DRIVE_SYNC_STATUS_KEY]: { state: 'idle' },
        [DRIVE_RESTORABLE_KEY]: [],
      });
      sendResponse({ ok: true });
    })().catch((err) => sendResponse({ ok: false, error: err && err.message }));
    return true;
  } else if (message.action === 'driveRestore') {
    // Explicit "Restore from Drive" for one workspace.
    (async () => {
      await getDeviceId();
      await ensureWorkspacesInit();
      const result = await syncEngine.restoreWorkspace(message.workspaceId);
      sendResponse(result);
    })().catch((err) => sendResponse({ ok: false, error: err && err.message }));
    return true;
  } else if (message.action === 'driveSetWorkspaceSync') {
    // Toggle a workspace's sync opt-in; on enable, flush promptly. The persist
    // above fires onChanged, and handleWorkspaceStorageChange enqueues the push
    // itself (a newly-enabled workspace with local changes has rev > baseRev), so
    // an explicit enqueuePush here would be redundant. We still schedule the
    // debounced flush directly so the queued push syncs promptly even if the
    // onChanged-driven flush scheduling were to race; if the workspace is already
    // in sync (rev === baseRev) nothing is queued and the flush is a cheap no-op.
    (async () => {
      await ensureWorkspacesInit();
      await workspaceManager.setWorkspaceSyncEnabled(message.workspaceId, message.enabled);
      if (message.enabled) {
        await getDeviceId();
        chrome.alarms.create(ALARM_FLUSH, { delayInMinutes: FLUSH_DEBOUNCE_MIN });
      }
      sendResponse({ ok: true });
    })().catch((err) => sendResponse({ ok: false, error: err && err.message }));
    return true;
  }
  // 不處理的 action：不攔截，讓 offscreen document 等其他 context 可以回應
});
