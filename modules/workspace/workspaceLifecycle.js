/**
 * Workspace lifecycle (background service worker ONLY).
 *
 * Owns the always-on parts of the workspace feature that must not depend on a
 * sidepanel being open:
 *
 *  1. LIVE SNAPSHOT — debounced re-snapshot of every BOUND window on tab/group
 *     mutations. This used to live in the sidepanel (own window only, only
 *     while the panel was open), which left a hole: browse with the panel
 *     closed → snapshot goes stale → those tabs are lost on the next restore.
 *  2. BINDING CLEANUP — windows.onRemoved drops the closed window's binding.
 *     Chrome recycles window ids across sessions; a stale entry could
 *     resurrect a workspace on an unrelated future window.
 *  3. STARTUP RE-BINDING — after a browser launch with session restore, every
 *     window has a new id, so windowWorkspaceMap is useless and every window
 *     would come back as "no workspace". We re-identify each restored window
 *     by matching its tab URLs against workspace snapshots (kept fresh up to
 *     ~SNAPSHOT_DEBOUNCE_MS before quit by #1) and rebind automatically.
 *
 * Context note: workspaceManager keeps an in-memory mirror PER JS context. In
 * the service worker this mirror can go stale at any moment (sidepanel writes,
 * SW restarts), so every async entry point here re-reads storage via
 * initWorkspaces() before acting — same pattern as background.js's
 * handleWorkspaceStorageChange. The extra reads are cheap relative to the
 * debounce window.
 *
 * MV3 lifetime: all listeners are registered synchronously at SW startup (the
 * init function is called from background.js top level). The debounce timers
 * live within one SW lifetime; if the SW is killed mid-debounce the snapshot
 * for that burst is lost, but the next tab event re-arms it — bounded, rare
 * staleness instead of the previous unbounded one.
 */
import * as workspaceManager from './workspaceManager.js';

/** Debounce for live snapshots. Long enough to coalesce bursts (tab sweeps,
 *  session restore opening 20 tabs), short enough that a quick quit after
 *  browsing loses almost nothing. Also bounds chrome.storage.sync write rate
 *  (quota ~120 writes/min) together with snapshotIntoWorkspace's
 *  content-equality skip. */
const SNAPSHOT_DEBOUNCE_MS = 2000;
/** Wait after onStartup before the first re-bind pass: session restore needs a
 *  moment to materialize windows/tabs (URLs are set even for unloaded tabs). */
const STARTUP_SETTLE_MS = 2500;
/** One late retry for slow restores (many windows / slow disk). */
const STARTUP_RETRY_MS = 8000;
/** Minimum similarity to auto-rebind. Live snapshots make a clean restart an
 *  exact match (1.0); 0.6 tolerates the user navigating a few tabs before the
 *  pass runs, while refusing coincidental overlaps. */
const REBIND_THRESHOLD = 0.6;

/** @type {Map<number, ReturnType<typeof setTimeout>>} windowId → pending snapshot timer */
const pendingSnapshots = new Map();

/**
 * Registers all listeners. MUST be called synchronously from the service
 * worker's top level so events re-wake the SW.
 */
export function initWorkspaceLifecycle() {
    // --- live snapshot triggers ---------------------------------------------
    chrome.tabs.onCreated.addListener(tab => markDirty(tab.windowId));
    chrome.tabs.onRemoved.addListener((_id, info) => {
        // A closing window fires onRemoved per tab while tearing down; never
        // snapshot that partial state (also guarded by the liveness check in
        // snapshotNow and the empty-snapshot guard in snapshotIntoWorkspace).
        if (!info.isWindowClosing) markDirty(info.windowId);
    });
    chrome.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
        // url / pinned / groupId are the tab fields a snapshot persists; title
        // flicker and favicon churn would just burn storage writes.
        if (changeInfo.url || changeInfo.pinned !== undefined || changeInfo.groupId !== undefined) {
            markDirty(tab.windowId);
        }
    });
    chrome.tabs.onMoved.addListener((_id, info) => markDirty(info.windowId));
    chrome.tabs.onAttached.addListener((_id, info) => markDirty(info.newWindowId));
    chrome.tabs.onDetached.addListener((_id, info) => markDirty(info.oldWindowId));
    // Group identity (title/color) is part of the snapshot too — covers manual
    // renames and the background AI auto-namer.
    chrome.tabGroups.onUpdated.addListener(g => markDirty(g.windowId));
    chrome.tabGroups.onRemoved.addListener(g => markDirty(g.windowId));

    // --- binding cleanup -------------------------------------------------------
    chrome.windows.onRemoved.addListener(windowId => {
        const timer = pendingSnapshots.get(windowId);
        if (timer) {
            clearTimeout(timer);
            pendingSnapshots.delete(windowId);
        }
        cleanupBinding(windowId).catch(err =>
            console.warn('[workspace-lifecycle] cleanup failed:', err));
    });

    // --- startup re-binding ------------------------------------------------------
    chrome.runtime.onStartup.addListener(() => {
        rebindAfterStartup().catch(err =>
            console.warn('[workspace-lifecycle] startup rebind failed:', err));
    });
}

function markDirty(windowId) {
    if (typeof windowId !== 'number' || windowId < 0) return;
    clearTimeout(pendingSnapshots.get(windowId));
    pendingSnapshots.set(windowId, setTimeout(() => {
        pendingSnapshots.delete(windowId);
        snapshotNow(windowId).catch(err =>
            console.warn('[workspace-lifecycle] snapshot failed:', err));
    }, SNAPSHOT_DEBOUNCE_MS));
}

async function snapshotNow(windowId) {
    await workspaceManager.initWorkspaces();
    const workspaceId = workspaceManager.getActiveWorkspaceId(windowId);
    if (!workspaceId) return;
    // Liveness check — debounced work can fire after the window is gone.
    const win = await chrome.windows.get(windowId).catch(() => null);
    if (!win) return;
    await workspaceManager.snapshotIntoWorkspace(workspaceId, windowId);
}

async function cleanupBinding(windowId) {
    await workspaceManager.initWorkspaces();
    if (workspaceManager.getActiveWorkspaceId(windowId)) {
        await workspaceManager.setActiveWorkspace(windowId, null);
    }
}

async function rebindAfterStartup() {
    await sleep(STARTUP_SETTLE_MS);
    const first = await rebindOnce();
    // Retry once for late-restoring windows. Also covers the "matched nothing
    // because restore hadn't materialized yet" case. A pass over an already-
    // settled state is a cheap no-op.
    if (first.unboundLeft > 0 || first.matched === 0) {
        await sleep(STARTUP_RETRY_MS);
        await rebindOnce();
    }
}

/**
 * One matching pass: prune dead bindings, then greedily bind unbound normal
 * windows to unbound workspaces by snapshot similarity.
 * @returns {Promise<{matched:number, unboundLeft:number}>}
 */
async function rebindOnce() {
    await workspaceManager.initWorkspaces();
    await workspaceManager.pruneWindowWorkspaceMap();

    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }).catch(() => []);
    const boundWorkspaceIds = new Set(
        wins.map(w => workspaceManager.getActiveWorkspaceId(w.id)).filter(Boolean)
    );

    // Window URLs filtered the same way snapshots are (http/file/ftp only) so
    // both sides of the similarity score speak the same language.
    const windowEntries = wins
        .filter(w => !workspaceManager.getActiveWorkspaceId(w.id))
        .map(w => ({
            windowId: w.id,
            urls: (w.tabs || [])
                .map(t => t.url || t.pendingUrl || '')
                .filter(u => /^(https?|file|ftp):/i.test(u)),
        }))
        .filter(e => e.urls.length > 0);

    const candidates = workspaceManager.getAllWorkspaces()
        .filter(ws => !boundWorkspaceIds.has(ws.id) && Array.isArray(ws.tabSnapshot) && ws.tabSnapshot.length > 0)
        .map(ws => ({ id: ws.id, urls: ws.tabSnapshot.map(s => s.url) }));

    const matches = workspaceManager.matchWindowsToWorkspaces(
        windowEntries, candidates, { threshold: REBIND_THRESHOLD });

    for (const m of matches) {
        await workspaceManager.setActiveWorkspace(m.windowId, m.workspaceId);
        console.info(`[workspace-lifecycle] rebound window ${m.windowId} → workspace ${m.workspaceId} (score ${m.score.toFixed(2)})`);
    }
    return { matched: matches.length, unboundLeft: windowEntries.length - matches.length };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
