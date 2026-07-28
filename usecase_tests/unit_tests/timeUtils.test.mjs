// Unit tests for modules/utils/timeUtils.js (BASE-024 P2).
import { formatRelativeTime, formatWakeTime } from '../../modules/utils/timeUtils.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = new Date(2026, 6, 22, 14, 0, 0).getTime(); // local 2026-07-22 14:00

// i18n resolver stub: echoes "key:subs" so assertions are locale-independent.
const gm = (key, subs) => `${key}${subs ? ':' + subs.join(',') : ''}`;
// Resolver that always misses → exercises the English fallbacks.
const miss = () => '';

describe('formatRelativeTime', () => {
    test('minute/hour/day granularity via i18n keys', () => {
        expect(formatRelativeTime(NOW - 30_000, NOW, gm)).toBe('timeJustNow');
        expect(formatRelativeTime(NOW - 5 * MIN, NOW, gm)).toBe('timeMinutesAgo:5');
        expect(formatRelativeTime(NOW - 59 * MIN, NOW, gm)).toBe('timeMinutesAgo:59');
        expect(formatRelativeTime(NOW - HOUR, NOW, gm)).toBe('timeHoursAgo:1');
        expect(formatRelativeTime(NOW - 23 * HOUR, NOW, gm)).toBe('timeHoursAgo:23');
        expect(formatRelativeTime(NOW - 24 * HOUR, NOW, gm)).toBe('timeDaysAgo:1');
        expect(formatRelativeTime(NOW - 72 * HOUR, NOW, gm)).toBe('timeDaysAgo:3');
    });
    test('future timestamps clamp to "just now"; fallbacks work without i18n', () => {
        expect(formatRelativeTime(NOW + HOUR, NOW, gm)).toBe('timeJustNow');
        expect(formatRelativeTime(NOW - 5 * MIN, NOW, miss)).toBe('5 min ago');
    });
});

describe('formatWakeTime', () => {
    const at = (d, h, m = 0) => new Date(2026, 6, d, h, m).getTime();

    test('same day → bare HH:mm', () => {
        expect(formatWakeTime(at(22, 20, 0), NOW, gm, 'en-GB')).toBe('20:00');
    });
    test('tomorrow → i18n wakeTomorrow with HH:mm', () => {
        expect(formatWakeTime(at(23, 9, 0), NOW, gm, 'en-GB')).toBe('wakeTomorrow:09:00');
        expect(formatWakeTime(at(23, 9, 0), NOW, miss, 'en-GB')).toBe('Tomorrow 09:00');
    });
    test('later → locale weekday + time (contains the time, no key)', () => {
        const label = formatWakeTime(at(27, 9, 0), NOW, gm, 'en-GB'); // next Monday
        expect(label).toContain('09:00');
        expect(label).not.toContain('wakeTomorrow');
    });
});
