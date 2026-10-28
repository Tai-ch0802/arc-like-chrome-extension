import {
    PREFS_SYNC_SCHEMA,
    PREF_SYNC_ALLOWLIST,
    canonicalizePrefs,
    mergePrefsState,
    prefsStateEqual,
    isPrefsSchemaTooNew,
    filterToAllowlist,
} from '../../modules/prefs/prefsSyncLogic.js';

const rec = (v, t) => ({ v, t });
const state = (entries, schema = PREFS_SYNC_SCHEMA) => ({ schema, entries });

// Small seeded PRNG (mulberry32) so randomized tests are reproducible.
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomState(rand) {
    const values = ['compact', 'cozy', 'dark', 'light', null, 0, 1, true, false, { a: 1 }, { a: 2 }, ['x']];
    const entries = {};
    for (const name of PREF_SYNC_ALLOWLIST) {
        if (rand() < 0.5) {
            entries[name] = rec(values[Math.floor(rand() * values.length)], Math.floor(rand() * 4)); // small t range => many ties
        }
    }
    return state(entries);
}

describe('prefsSyncLogic — pure preference LWW merge', () => {
    describe('allowlist', () => {
        it('has exactly the 19 expected names and is frozen', () => {
            expect(PREF_SYNC_ALLOWLIST).toHaveLength(19);
            expect(new Set(PREF_SYNC_ALLOWLIST).size).toBe(19);
            expect(Object.isFrozen(PREF_SYNC_ALLOWLIST)).toBe(true);
            for (const n of ['theme', 'listDensity', 'readingListSortOrder', 'routingEnabled']) {
                expect(PREF_SYNC_ALLOWLIST).toContain(n);
            }
        });
    });

    describe('canonicalizePrefs', () => {
        it('keeps unknown (non-allowlisted) names for forward compatibility', () => {
            const out = canonicalizePrefs(state({
                theme: rec('dark', 1),
                futureKey: rec('x', 5),
            }));
            expect(Object.keys(out.entries)).toEqual(['futureKey', 'theme']);
        });

        it('rejects records whose v is undefined', () => {
            const out = canonicalizePrefs(state({ theme: { t: 1 }, listDensity: { v: undefined, t: 1 }, uiLanguage: rec(null, 1) }));
            expect(Object.keys(out.entries)).toEqual(['uiLanguage']);
        });

        it('returns cloned v values (no aliasing with input)', () => {
            const input = state({ theme: rec({ a: [1] }, 1) });
            const out = canonicalizePrefs(input);
            out.entries.theme.v.a.push(2);
            expect(input.entries.theme.v.a).toEqual([1]);
        });

        it('drops invalid records but keeps null values', () => {
            const out = canonicalizePrefs(state({
                theme: rec(null, 0),
                listDensity: rec('x', -1),
                customTheme: rec('x', NaN),
                uiLanguage: rec('x', Infinity),
                sectionOrder: rec('x', '5'),
                routingEnabled: 'nope',
                autoArchiveEnabled: null,
                autoArchiveIdleHours: { v: 3 },
            }));
            expect(out.entries).toEqual({ theme: rec(null, 0) });
        });

        it('sorts entry keys ascending', () => {
            const out = canonicalizePrefs(state({ theme: rec(1, 1), customTheme: rec(2, 1), listDensity: rec(3, 1) }));
            expect(Object.keys(out.entries)).toEqual(['customTheme', 'listDensity', 'theme']);
        });

        it('defaults schema when missing or invalid', () => {
            expect(canonicalizePrefs({ entries: {} }).schema).toBe(PREFS_SYNC_SCHEMA);
            expect(canonicalizePrefs({ schema: 'x', entries: {} }).schema).toBe(PREFS_SYNC_SCHEMA);
        });

        it('tolerates null / undefined / non-object input', () => {
            for (const bad of [null, undefined, 5, 'str', [], { entries: null }, { entries: 3 }]) {
                expect(canonicalizePrefs(bad)).toEqual({ schema: PREFS_SYNC_SCHEMA, entries: {} });
            }
        });

        it('never mutates its input', () => {
            const input = state({ theme: rec({ a: 1 }, 2), driveWebAuth: rec(1, 1), listDensity: rec('x', -3) });
            const snapshot = JSON.parse(JSON.stringify(input));
            canonicalizePrefs(input);
            expect(input).toEqual(snapshot);
        });
    });

    describe('mergePrefsState', () => {
        it('absent = no claim: remote-only record is taken (t = 0)', () => {
            const out = mergePrefsState(state({}), state({ listDensity: rec('compact', 0) }));
            expect(out.entries.listDensity).toEqual(rec('compact', 0));
        });

        it('absent = no claim: local-only record is kept (mirror)', () => {
            const out = mergePrefsState(state({ listDensity: rec('compact', 0) }), state({}));
            expect(out.entries.listDensity).toEqual(rec('compact', 0));
        });

        it('larger t wins regardless of argument order', () => {
            const a = state({ theme: rec('dark', 10) });
            const b = state({ theme: rec('light', 20) });
            expect(mergePrefsState(a, b).entries.theme).toEqual(rec('light', 20));
            expect(mergePrefsState(b, a).entries.theme).toEqual(rec('light', 20));
        });

        it('equal t tie-breaks deterministically on JSON.stringify(v), both orders', () => {
            const a = state({ theme: rec('apple', 5) });
            const b = state({ theme: rec('banana', 5) });
            expect(mergePrefsState(a, b).entries.theme).toEqual(rec('banana', 5));
            expect(mergePrefsState(b, a).entries.theme).toEqual(rec('banana', 5));
        });

        it('passes unknown keys through the merge (forward compat)', () => {
            const out = mergePrefsState(state({ futureKey: rec(1, 1) }), state({ futureKey: rec(2, 2), theme: rec('x', 1) }));
            expect(out.entries.futureKey).toEqual(rec(2, 2));
            expect(Object.keys(filterToAllowlist(out.entries))).toEqual(['theme']);
        });

        it('merge result does not alias input values', () => {
            const a = state({ theme: rec({ k: [1] }, 1) });
            const out = mergePrefsState(a, state({}));
            out.entries.theme.v.k.push(9);
            expect(a.entries.theme.v.k).toEqual([1]);
        });

        it('tie-break is insensitive to object key order', () => {
            const a = state({ theme: rec({ a: 1, b: 2 }, 5) });
            const b = state({ theme: rec({ b: 2, a: 1 }, 5) });
            expect(mergePrefsState(a, b)).toEqual(mergePrefsState(b, a));
            expect(JSON.stringify(mergePrefsState(a, b))).toBe(JSON.stringify(mergePrefsState(b, a)));
        });

        it('result schema is PREFS_SYNC_SCHEMA', () => {
            expect(mergePrefsState(null, null).schema).toBe(PREFS_SYNC_SCHEMA);
            expect(mergePrefsState(state({}, 9), state({}, 9)).schema).toBe(PREFS_SYNC_SCHEMA);
        });

        it('does not mutate inputs', () => {
            const a = state({ theme: rec('a', 1) });
            const b = state({ theme: rec('b', 2) });
            const sa = JSON.parse(JSON.stringify(a));
            const sb = JSON.parse(JSON.stringify(b));
            mergePrefsState(a, b);
            expect(a).toEqual(sa);
            expect(b).toEqual(sb);
        });

        it('is commutative and idempotent over seeded random states', () => {
            const rand = rng(257);
            for (let i = 0; i < 300; i++) {
                const a = randomState(rand);
                const b = randomState(rand);
                const ab = mergePrefsState(a, b);
                const ba = mergePrefsState(b, a);
                expect(ab).toEqual(ba);
                expect(JSON.stringify(ab)).toBe(JSON.stringify(ba));
                expect(mergePrefsState(ab, ab)).toEqual(ab);
                expect(mergePrefsState(ab, b)).toEqual(ab);
                expect(mergePrefsState(ab, a)).toEqual(ab);
                expect(mergePrefsState(a, a)).toEqual(canonicalizePrefs(a));
            }
        });

        it('is associative over seeded random states', () => {
            const rand = rng(42);
            for (let i = 0; i < 100; i++) {
                const a = randomState(rand);
                const b = randomState(rand);
                const c = randomState(rand);
                expect(mergePrefsState(mergePrefsState(a, b), c)).toEqual(mergePrefsState(a, mergePrefsState(b, c)));
            }
        });
    });

    describe('prefsStateEqual', () => {
        it('ignores key order', () => {
            const a = { schema: 1, entries: { theme: rec('x', 1), listDensity: rec('y', 2) } };
            const b = { schema: 1, entries: { listDensity: rec('y', 2), theme: rec('x', 1) } };
            expect(prefsStateEqual(a, b)).toBe(true);
        });

        it('detects real differences', () => {
            const a = state({ theme: rec('x', 1) });
            expect(prefsStateEqual(a, state({ theme: rec('x', 1) }))).toBe(true);
            expect(prefsStateEqual(a, state({ theme: rec('x', 2) }))).toBe(false);
            expect(prefsStateEqual(a, state({ theme: rec('y', 1) }))).toBe(false);
        });

        it('treats object values with different key order as equal', () => {
            expect(prefsStateEqual(state({ theme: rec({ a: 1, b: { c: 1, d: 2 } }, 1) }), state({ theme: rec({ b: { d: 2, c: 1 }, a: 1 }, 1) }))).toBe(true);
        });

        it('treats null/undefined as empty', () => {
            expect(prefsStateEqual(null, state({}))).toBe(true);
        });
    });

    describe('filterToAllowlist', () => {
        it('keeps only allowlisted names (driveWebAuth / tabGroupsUnsupported never survive) without mutating', () => {
            const entries = { theme: rec('x', 1), driveWebAuth: rec('s', 1), tabGroupsUnsupported: rec(true, 1) };
            const snap = JSON.parse(JSON.stringify(entries));
            expect(filterToAllowlist(entries)).toEqual({ theme: rec('x', 1) });
            expect(entries).toEqual(snap);
        });
        it('tolerates bad input', () => {
            expect(filterToAllowlist(null)).toEqual({});
        });
    });

    describe('isPrefsSchemaTooNew', () => {
        it('detects a newer schema', () => {
            expect(isPrefsSchemaTooNew({ schema: PREFS_SYNC_SCHEMA + 1 })).toBe(true);
        });
        it('false for current, older, missing, non-number or null', () => {
            expect(isPrefsSchemaTooNew({ schema: PREFS_SYNC_SCHEMA })).toBe(false);
            expect(isPrefsSchemaTooNew({ schema: 0 })).toBe(false);
            expect(isPrefsSchemaTooNew({})).toBe(false);
            expect(isPrefsSchemaTooNew({ schema: '99' })).toBe(false);
            expect(isPrefsSchemaTooNew(null)).toBe(false);
        });
    });
});
