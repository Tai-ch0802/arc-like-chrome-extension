// Unit tests for modules/lifecycle/lifecycleLogic.js (pure functions, BASE-024).
import {
    selectArchiveCandidates,
    resolveSnoozeSlots,
    isWakeExpired,
    ARCHIVE_BATCH_CAP,
} from '../../modules/lifecycle/lifecycleLogic.js';

const HOUR = 3600_000;
const NOW = new Date(2026, 6, 22, 14, 0, 0).getTime(); // 2026-07-22 (Wed) 14:00 local

let nextId = 1;
const tab = (over = {}) => ({
    id: nextId++,
    windowId: 1,
    url: 'https://example.com/x',
    pinned: false,
    active: false,
    audible: false,
    groupId: -1,
    lastAccessed: NOW - 13 * HOUR, // idle beyond a 12h threshold by default
    ...over,
});

describe('selectArchiveCandidates (FR-1.03 exemption chain)', () => {
    const threshold = 12 * HOUR;
    // A filler keeps the window from ever being emptied by the tab under test.
    const filler = (windowId = 1) => tab({ windowId, pinned: true });

    test('an idle, unexempted tab is selected', () => {
        const t = tab();
        expect(selectArchiveCandidates([t, filler()], NOW, threshold)).toEqual([t]);
    });

    test.each([
        ['pinned', { pinned: true }],
        ['in a group', { groupId: 7 }],
        ['active', { active: true }],
        ['audible', { audible: true }],
        ['internal page', { url: 'chrome://settings' }],
        ['missing lastAccessed', { lastAccessed: undefined }],
        ['not idle enough', { lastAccessed: NOW - 11 * HOUR }],
    ])('exempts a tab that is %s', (_label, over) => {
        expect(selectArchiveCandidates([tab(over), filler()], NOW, threshold)).toEqual([]);
    });

    test('idle boundary is strict (> threshold)', () => {
        const exact = tab({ lastAccessed: NOW - threshold });
        expect(selectArchiveCandidates([exact, filler()], NOW, threshold)).toEqual([]);
        const past = tab({ lastAccessed: NOW - threshold - 1 });
        expect(selectArchiveCandidates([past, filler()], NOW, threshold)).toEqual([past]);
    });

    test('oldest-idle first, capped at the batch limit (FR-1.05)', () => {
        const tabs = Array.from({ length: 15 }, (_, i) => tab({ lastAccessed: NOW - (13 + i) * HOUR }));
        const selected = selectArchiveCandidates([...tabs, filler()], NOW, threshold);
        expect(selected).toHaveLength(ARCHIVE_BATCH_CAP);
        expect(selected[0].lastAccessed).toBe(NOW - 27 * HOUR); // oldest taken first
    });

    test('never empties a window — counts THIS round\'s removals (FR-1.03f)', () => {
        // A window whose only tab is idle: excluded outright.
        const solo = tab({ windowId: 9 });
        expect(selectArchiveCandidates([solo], NOW, threshold)).toEqual([]);

        // Two idle candidates alone in one window: only the older one is taken.
        const a = tab({ windowId: 5, lastAccessed: NOW - 20 * HOUR });
        const b = tab({ windowId: 5, lastAccessed: NOW - 15 * HOUR });
        expect(selectArchiveCandidates([a, b], NOW, threshold)).toEqual([a]);

        // An exempt tab still counts toward window size: candidate can be taken.
        const c = tab({ windowId: 6 });
        expect(selectArchiveCandidates([c, filler(6)], NOW, threshold)).toEqual([c]);
    });
});

describe('resolveSnoozeSlots (FR-4.01)', () => {
    const at = (y, mo, d, h, mi = 0) => new Date(y, mo, d, h, mi, 0, 0).getTime();
    const slots = (now) => Object.fromEntries(resolveSnoozeSlots(now).map(s => [s.key, s.at]));

    test('later1h is exactly now + 1h', () => {
        expect(slots(NOW).later1h).toBe(NOW + HOUR);
    });

    test('tonight is today 20:00, rolling to tomorrow when already passed', () => {
        expect(slots(at(2026, 6, 22, 14)).tonight).toBe(at(2026, 6, 22, 20));
        expect(slots(at(2026, 6, 22, 21)).tonight).toBe(at(2026, 6, 23, 20));
        expect(slots(at(2026, 6, 22, 20)).tonight).toBe(at(2026, 6, 23, 20)); // inclusive roll
    });

    test('tomorrow is always next day 09:00 (even before 09:00 today)', () => {
        expect(slots(at(2026, 6, 22, 8)).tomorrow).toBe(at(2026, 6, 23, 9));
        expect(slots(at(2026, 6, 22, 23)).tomorrow).toBe(at(2026, 6, 23, 9));
    });

    test('nextMonday from each weekday; a Monday goes to the FOLLOWING Monday', () => {
        expect(slots(at(2026, 6, 22, 14)).nextMonday).toBe(at(2026, 6, 27, 9)); // Wed → next Mon 07-27
        expect(slots(at(2026, 6, 27, 10)).nextMonday).toBe(at(2026, 7, 3, 9));  // Mon → +7 (08-03)
        expect(slots(at(2026, 6, 26, 10)).nextMonday).toBe(at(2026, 6, 27, 9)); // Sun → next day
        expect(slots(at(2026, 6, 25, 10)).nextMonday).toBe(at(2026, 6, 27, 9)); // Sat → +2
    });
});

describe('isWakeExpired', () => {
    test('due at or before now; robust to junk', () => {
        expect(isWakeExpired({ wakeAt: NOW }, NOW)).toBe(true);
        expect(isWakeExpired({ wakeAt: NOW + 1 }, NOW)).toBe(false);
        expect(isWakeExpired(null, NOW)).toBe(false);
        expect(isWakeExpired({}, NOW)).toBe(false);
    });
});
