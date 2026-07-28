// --- Lifecycle Engine (background service worker only) ---
// Auto-Archive scan + snooze wake/sweep (BASE-024 SA §5.2/5.4). SW-specific
// module (direct chrome.*, same exception as routingEngine/workspaceLifecycle).
//
// Data-safety invariants (PRD FR-1.04 / SA §5.4):
//   - Archive: batch-persist FIRST, close tabs after; a close failure
//     compensates by removing that item so tab & record never diverge.
//   - Wake: open the tab FIRST, remove the record after; an open failure
//     keeps the record for the next sweep. Either direction, the URL exists
//     in at least one place at every instant.

import { selectArchiveCandidates, isWakeExpired, DEFAULT_IDLE_HOURS, ARCHIVE_BATCH_CAP } from './lifecycleLogic.js';
import * as store from './archiveStore.js';

export const HEARTBEAT_ALARM = 'lifecycleHeartbeat';
export const WAKE_ALARM_PREFIX = 'lifecycleWake_';
const HEARTBEAT_PERIOD_MIN = 30;
const AUTO_ARCHIVE_KEY = 'autoArchiveEnabled';
const IDLE_HOURS_KEY = 'autoArchiveIdleHours';

let enabledCache = null;   // boolean | null (opt-in, default false)
let idleHoursCache = null; // number | null

// All SW-side lifecycle work is serialized through one chain (rssSyncOnce
// convention): archiveStore is lock-free read-modify-write, so overlapping
// heartbeats / wake alarms must never interleave store mutations (review
// PR #220). Cross-CONTEXT writers arrive in P2 — that design is recorded in
// the SA as a P2 precondition; this chain covers every SW-side entry point.
let opChain = Promise.resolve();
function serialize(fn) {
    opChain = opChain.then(fn).catch(err => console.warn('[lifecycle] op failed', err));
    return opChain;
}

async function ensureEnabled() {
    if (enabledCache === null) {
        const res = await chrome.storage.sync.get({ [AUTO_ARCHIVE_KEY]: false });
        enabledCache = res[AUTO_ARCHIVE_KEY] === true; // opt-in (FR-1.01)
    }
    return enabledCache;
}

async function ensureIdleHours() {
    if (idleHoursCache === null) {
        const res = await chrome.storage.sync.get({ [IDLE_HOURS_KEY]: DEFAULT_IDLE_HOURS });
        const v = Number(res[IDLE_HOURS_KEY]);
        // Permissive: any positive number of hours (the UI offers six presets;
        // this tolerance doubles as the E2E seam — SA §8.1).
        idleHoursCache = (Number.isFinite(v) && v > 0) ? v : DEFAULT_IDLE_HOURS;
    }
    return idleHoursCache;
}

/** Create the heartbeat only when absent — re-creating resets the period and
 *  frequent SW wakes would postpone it forever. */
function ensureHeartbeat() {
    chrome.alarms.get(HEARTBEAT_ALARM, (existing) => {
        if (!existing) {
            chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MIN });
        }
    });
}

/** SW → sidepanel broadcast; rejection (no receiver) is expected and ignored. */
function notifyArchived(items) {
    try {
        chrome.runtime.sendMessage({ type: 'lifecycle:archived', items }).catch(() => {});
    } catch { /* no receiver */ }
}

/** One scan round (FR-1.02~1.05). */
async function scanIdleTabs() {
    if (!(await ensureEnabled())) return; // FR-5.02: switch only stops the scan
    const hours = await ensureIdleHours();
    const tabs = await chrome.tabs.query({ windowType: 'normal' });
    const candidates = selectArchiveCandidates(tabs, Date.now(), hours * 3600_000, ARCHIVE_BATCH_CAP);
    if (!candidates.length) return;

    const now = Date.now();
    const items = candidates.map(t => ({
        id: crypto.randomUUID(),
        url: t.url,
        title: t.title || t.url,
        favIconUrl: t.favIconUrl || '',
        archivedAt: now,
        source: 'auto',
    }));

    try {
        await store.addArchived(items); // FR-1.04: persist BEFORE closing
    } catch (err) {
        console.warn('[lifecycle] archive persist failed — no tabs closed', err);
        return;
    }

    const archived = [];
    for (let i = 0; i < candidates.length; i++) {
        try {
            await chrome.tabs.remove(candidates[i].id);
            archived.push(items[i]);
        } catch {
            // Close failed (already gone / dragging): compensate so the open
            // tab is not duplicated in the archive.
            await store.removeArchived([items[i].id]).catch(() => {});
        }
    }
    if (archived.length) notifyArchived(archived);
}

/** Wake one snoozed item (FR-4.03): open first, remove record after. */
async function wake(id) {
    const state = await store.getSnoozed();
    const item = state.items.find(i => i.id === id);
    if (!item) return; // cancelled meanwhile
    let tab;
    try {
        tab = await chrome.tabs.create({ url: item.url, active: false });
    } catch (err) {
        console.warn('[lifecycle] wake open failed — record kept for next sweep', err);
        return;
    }
    notifySnoozeWake(tab.id, item.title);
    await store.removeSnoozed(id);
}

function notifySnoozeWake(tabId, title) {
    if (!chrome.notifications) return;
    try {
        chrome.notifications.create(`snooze:${tabId}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/extension-icon-128.png'),
            title: chrome.i18n.getMessage('snoozeWakeNotifTitle') || 'Snoozed tab is back',
            message: title || '',
            priority: 1,
        });
    } catch { /* notification is best-effort */ }
}

/** FR-4.04: catch up items whose wakeAt passed while the browser was closed. */
async function sweepExpiredSnoozes() {
    const state = await store.getSnoozed();
    const now = Date.now();
    for (const item of state.items) {
        if (isWakeExpired(item, now)) {
            await wake(item.id).catch(err => console.warn('[lifecycle] sweep wake failed', err));
        }
    }
}

/**
 * Alarm entry point, called from background.js's single onAlarm dispatcher
 * (explicit branches there — repo fall-through hazard).
 */
export function handleLifecycleAlarm(alarm) {
    if (alarm.name === HEARTBEAT_ALARM) {
        return serialize(() => sweepExpiredSnoozes().then(() => scanIdleTabs()));
    }
    if (alarm.name.startsWith(WAKE_ALARM_PREFIX)) {
        const id = alarm.name.slice(WAKE_ALARM_PREFIX.length);
        return serialize(() => wake(id));
    }
    return Promise.resolve();
}

/**
 * Notification-click chain member (background.js notifications.onClicked):
 * claims only the `snooze:` prefix, returns true when claimed.
 */
export function handleSnoozeNotificationClick(notificationId) {
    if (typeof notificationId !== 'string' || !notificationId.startsWith('snooze:')) return false;
    const tabId = Number(notificationId.slice('snooze:'.length));
    try { chrome.notifications.clear(notificationId); } catch { /* noop */ }
    if (Number.isFinite(tabId)) {
        (async () => {
            const tab = await chrome.tabs.get(tabId);
            await chrome.tabs.update(tabId, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
        })().catch(() => { /* tab closed since */ });
    }
    return true;
}

/** Register listeners. MUST be called synchronously at SW top level (MV3). */
export function initLifecycleEngine() {
    chrome.runtime.onInstalled.addListener(() => ensureHeartbeat());
    chrome.runtime.onStartup.addListener(() => {
        ensureHeartbeat();
        serialize(() => sweepExpiredSnoozes());
    });
    ensureHeartbeat(); // SW cold start (idempotent: create only when absent)

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        if (changes[AUTO_ARCHIVE_KEY]) enabledCache = null;
        if (changes[IDLE_HOURS_KEY]) idleHoursCache = null;
    });
}
