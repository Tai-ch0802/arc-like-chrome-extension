/**
 * @file lamportClock.js
 * Lamport-lite monotonic timestamp shared by every Drive-synced feature
 * (RSS subscriptions, preferences, reading list).
 *
 * Guarantees the returned value is strictly greater than any timestamp this
 * device has already observed for the record, so a device whose wall clock
 * runs slow cannot mint an `updatedAt` that looks OLDER than what it last
 * wrote (which would let a stale edit lose forever).
 *
 * @param {number} known - the largest timestamp already seen for this record (0 if none).
 * @param {number} now - Date.now() supplied by the caller.
 * @returns {number}
 */
export function nextTimestamp(known, now) {
    return Math.max(now || 0, (known || 0) + 1);
}
