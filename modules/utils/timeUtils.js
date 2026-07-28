// --- Time formatting utilities (BASE-024 P2) ---
// Pure functions: `now` and the i18n resolver are injected, so everything is
// unit-testable in Node. First shared time util in the repo — earlier features
// each rolled their own (readingList day-level label, newswire absolute clock).

/**
 * Relative "how long ago" label (e.g. "3 hours ago"), minute/hour/day granular.
 * @param {number} ts - epoch ms of the event
 * @param {number} now - epoch ms
 * @param {(key: string, subs?: string[]) => string} getMessage - i18n resolver
 * @returns {string}
 */
export function formatRelativeTime(ts, now, getMessage) {
    const minutes = Math.floor(Math.max(0, now - ts) / 60_000);
    if (minutes < 1) return getMessage('timeJustNow') || 'just now';
    if (minutes < 60) return getMessage('timeMinutesAgo', [String(minutes)]) || `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return getMessage('timeHoursAgo', [String(hours)]) || `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return getMessage('timeDaysAgo', [String(days)]) || `${days} d ago`;
}

/**
 * Wake-time label for snoozed items: today → "20:00", tomorrow → i18n
 * "Tomorrow 09:00", later → locale short weekday + time.
 * @param {number} wakeAt - epoch ms
 * @param {number} now - epoch ms
 * @param {(key: string, subs?: string[]) => string} getMessage
 * @param {string} [locale] - BCP-47 tag for Intl; undefined = browser default
 * @returns {string}
 */
export function formatWakeTime(wakeAt, now, getMessage, locale) {
    const wake = new Date(wakeAt);
    const today = new Date(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hm = new Intl.DateTimeFormat(locale || undefined, {
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(wake);

    if (wake.toDateString() === today.toDateString()) return hm;
    if (wake.toDateString() === tomorrow.toDateString()) {
        return getMessage('wakeTomorrow', [hm]) || `Tomorrow ${hm}`;
    }
    return new Intl.DateTimeFormat(locale || undefined, {
        weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(wake);
}
