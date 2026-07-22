// newswire P0 system-notification content (BASE-016 N4).
// Pure helpers (no chrome / no Date) so the night-session rule and title
// formatting are unit-testable. The chrome.notifications.create call itself
// stays in feedManager.

// 台北夜盤數據帶(SA §6 / PRD §5.3):20:20–22:35 的 P0 前綴 ⚡夜盤,其餘 ⚡。
export const NIGHT_START_MIN = 20 * 60 + 20; // 20:20 台北
export const NIGHT_END_MIN = 22 * 60 + 35;   // 22:35 台北

/**
 * True iff the given epoch-ms falls in the Taipei night-session window. Taipei is
 * UTC+8 with NO daylight saving, so wall-clock minutes-of-day derive from the
 * epoch arithmetically — no Date/Intl needed (keeps this pure & testable).
 * @param {number} tsMs epoch milliseconds
 * @returns {boolean}
 */
export function isTaipeiNightSession(tsMs) {
    if (!Number.isFinite(tsMs)) return false;
    const minOfDay = (Math.floor(tsMs / 60000) + 480) % 1440; // +8h, wrap to a day
    const m = (minOfDay + 1440) % 1440; // normalise negatives (pre-1970 / clock skew)
    return m >= NIGHT_START_MIN && m <= NIGHT_END_MIN;
}

/**
 * Build the P0 notification title/message from a NewsEvent. Title carries the ⚡
 * (or ⚡夜盤) prefix and the upper-cased source tag; message is the headline.
 * Keys the night rule off the event's publish time (tsSource), falling back to
 * now.
 * @param {object} event NewsEvent (importance 0)
 * @param {number} nowMs
 * @returns {{title:string, message:string}}
 */
export function buildP0Notification(event, nowMs) {
    const at = Number.isFinite(event?.tsSource) ? event.tsSource : nowMs;
    const prefix = isTaipeiNightSession(at) ? '⚡夜盤' : '⚡';
    const source = String(event?.source || '').toUpperCase();
    return {
        title: `${prefix} ${source}`.trim(),
        message: String(event?.title || ''),
    };
}
