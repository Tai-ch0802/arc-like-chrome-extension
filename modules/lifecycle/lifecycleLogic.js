// --- Tab Lifecycle Logic (pure) ---
// Pure decision functions for Auto-Archive + Snooze (BASE-024 SA §5.2/5.3).
// No chrome.*, no Date.now(): time enters via `now` so every branch is
// unit-testable in Node (same convention as routing/routingLogic.js).

import { isRealHttpUrl } from '../routing/routingLogic.js';

export const DEFAULT_IDLE_HOURS = 12;
export const ARCHIVE_BATCH_CAP = 10;      // FR-1.05: per-scan max
export const ARCHIVE_MAX_ITEMS = 500;     // FR-2.01: FIFO cap
/** chrome.tabGroups.TAB_GROUP_ID_NONE — literal so this module stays chrome-free. */
const GROUP_NONE = -1;

/**
 * Select which tabs to archive this round (FR-1.02/1.03/1.05).
 * Exemption chain: pinned / in a group / active / audible / non-http(s) /
 * missing lastAccessed (pre-Chrome 122 → conservatively never archive, same
 * caveat as aiCleanupUI) / would leave a window empty. Oldest-idle first,
 * capped; the "last tab in window" check counts THIS round's removals so two
 * candidates in a two-tab window can never both be taken.
 *
 * @param {Array<{id,windowId,url,pinned,active,audible,groupId,lastAccessed}>} tabs
 *        ALL tabs of normal windows (exempt tabs included — window sizing needs them).
 * @param {number} now
 * @param {number} thresholdMs
 * @param {number} [cap=ARCHIVE_BATCH_CAP]
 * @returns {Array} the selected tab objects
 */
export function selectArchiveCandidates(tabs, now, thresholdMs, cap = ARCHIVE_BATCH_CAP) {
    const all = Array.isArray(tabs) ? tabs : [];
    const perWindowCount = new Map();
    for (const t of all) {
        perWindowCount.set(t.windowId, (perWindowCount.get(t.windowId) || 0) + 1);
    }

    const eligible = all
        .filter(t => !t.pinned
            && (t.groupId === undefined || t.groupId === GROUP_NONE)
            && !t.active
            && !t.audible
            && isRealHttpUrl(t.url)
            && typeof t.lastAccessed === 'number' && t.lastAccessed > 0
            && (now - t.lastAccessed) > thresholdMs)
        .sort((a, b) => a.lastAccessed - b.lastAccessed); // oldest first

    const selected = [];
    for (const t of eligible) {
        if (selected.length >= cap) break;
        const remaining = perWindowCount.get(t.windowId) || 0;
        if (remaining <= 1) continue; // FR-1.03(f): never empty a window
        perWindowCount.set(t.windowId, remaining - 1);
        selected.push(t);
    }
    return selected;
}

/**
 * The four fixed snooze slots (FR-4.01), resolved against `now`.
 * A slot whose time already passed rolls to the next day's same time;
 * "next Monday" on a Monday means the FOLLOWING Monday.
 * All computations use the local timezone via Date(now).
 *
 * @param {number} now
 * @returns {Array<{key: 'later1h'|'tonight'|'tomorrow'|'nextMonday', at: number}>}
 */
export function resolveSnoozeSlots(now) {
    const later1h = now + 60 * 60 * 1000;

    const tonight = new Date(now);
    tonight.setHours(20, 0, 0, 0);
    if (tonight.getTime() <= now) tonight.setDate(tonight.getDate() + 1);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const nextMonday = new Date(now);
    const day = nextMonday.getDay(); // 0=Sun … 1=Mon
    const daysAhead = day === 1 ? 7 : ((8 - day) % 7 || 7);
    nextMonday.setDate(nextMonday.getDate() + daysAhead);
    nextMonday.setHours(9, 0, 0, 0);

    return [
        { key: 'later1h', at: later1h },
        { key: 'tonight', at: tonight.getTime() },
        { key: 'tomorrow', at: tomorrow.getTime() },
        { key: 'nextMonday', at: nextMonday.getTime() },
    ];
}

/** @returns {boolean} true iff the snooze item is due (FR-4.04 sweep predicate). */
export function isWakeExpired(item, now) {
    return !!item && typeof item.wakeAt === 'number' && item.wakeAt <= now;
}
