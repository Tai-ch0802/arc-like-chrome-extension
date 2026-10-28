import {
    RL_SYNC_SCHEMA,
    RL_TOMBSTONE_GC_MS,
    canonicalizeReadingListState,
    mergeReadingListState,
    diffReadingList,
    readingListStateEqual,
    isReadingListSchemaTooNew,
    tombstoneTimestamp,
} from '../../modules/readingList/readingListSyncLogic.js';

const NOW = 1_700_000_000_000;
const T = (d) => NOW + d;
const opts = { now: NOW };

const entry = (over = {}) => ({ title: 't', hasBeenRead: false, createdAt: T(-1000), updatedAt: T(-500), ...over });
const state = (entries = {}, tombstones = {}) => ({ schema: 1, entries, tombstones });

describe('readingListSyncLogic — pure reading-list Drive-sync merge', () => {
    describe('constants', () => {
        it('exposes schema 1 and a 180-day GC window', () => {
            expect(RL_SYNC_SCHEMA).toBe(1);
            expect(RL_TOMBSTONE_GC_MS).toBe(180 * 24 * 60 * 60 * 1000);
        });
    });

    describe('mergeReadingListState', () => {
        it('unions entries from both sides and stamps the schema', () => {
            const m = mergeReadingListState(
                state({ 'https://a': entry() }),
                state({ 'https://b': entry({ title: 'B' }) }),
                opts,
            );
            expect(Object.keys(m.entries)).toEqual(['https://a', 'https://b']);
            expect(m.schema).toBe(RL_SYNC_SCHEMA);
        });

        it('larger updatedAt wins', () => {
            const a = state({ 'https://a': entry({ title: 'old', updatedAt: T(-100) }) });
            const b = state({ 'https://a': entry({ title: 'new', updatedAt: T(-50) }) });
            expect(mergeReadingListState(a, b, opts).entries['https://a'].title).toBe('new');
            expect(mergeReadingListState(b, a, opts).entries['https://a'].title).toBe('new');
        });

        it('equal updatedAt: hasBeenRead:true wins (both orders)', () => {
            const a = state({ 'https://a': entry({ hasBeenRead: true, title: 'a' }) });
            const b = state({ 'https://a': entry({ hasBeenRead: false, title: 'z' }) });
            expect(mergeReadingListState(a, b, opts).entries['https://a'].hasBeenRead).toBe(true);
            expect(mergeReadingListState(b, a, opts).entries['https://a'].hasBeenRead).toBe(true);
            expect(mergeReadingListState(b, a, opts).entries['https://a'].title).toBe('a');
        });

        it('equal updatedAt and equal read flag: lexicographically greater title JSON wins', () => {
            const a = state({ 'https://a': entry({ title: 'apple' }) });
            const b = state({ 'https://a': entry({ title: 'banana' }) });
            expect(mergeReadingListState(a, b, opts).entries['https://a'].title).toBe('banana');
            expect(mergeReadingListState(b, a, opts).entries['https://a'].title).toBe('banana');
        });

        it('keeps the minimum createdAt of both sides', () => {
            const a = state({ 'https://a': entry({ createdAt: T(-900), updatedAt: T(-10) }) });
            const b = state({ 'https://a': entry({ createdAt: T(-2000), updatedAt: T(-20) }) });
            const m = mergeReadingListState(a, b, opts).entries['https://a'];
            expect(m.createdAt).toBe(T(-2000));
            expect(m.updatedAt).toBe(T(-10));
        });

        it('does not normalize URLs (exact string match)', () => {
            const m = mergeReadingListState(
                state({ 'https://a/': entry() }),
                state({ 'https://a': entry() }),
                opts,
            );
            expect(Object.keys(m.entries)).toHaveLength(2);
        });

        it('tombstone excludes an entry with updatedAt <= deletedAt', () => {
            const e = entry({ updatedAt: T(-100) });
            const lt = mergeReadingListState(state({ 'https://a': e }), state({}, { 'https://a': T(-50) }), opts);
            expect(lt.entries['https://a']).toBeUndefined();
            expect(lt.tombstones['https://a']).toBe(T(-50));
            const eq = mergeReadingListState(state({ 'https://a': e }), state({}, { 'https://a': T(-100) }), opts);
            expect(eq.entries['https://a']).toBeUndefined();
        });

        it('a later edit (updatedAt > deletedAt) resurrects and drops the tombstone', () => {
            const a = state({ 'https://a': entry({ updatedAt: T(-10) }) });
            const b = state({}, { 'https://a': T(-100) });
            for (const m of [mergeReadingListState(a, b, opts), mergeReadingListState(b, a, opts)]) {
                expect(m.entries['https://a']).toBeDefined();
                expect(m.tombstones['https://a']).toBeUndefined();
            }
        });

        it('tombstones are unioned taking max deletedAt', () => {
            const m = mergeReadingListState(
                state({}, { 'https://a': T(-300), 'https://b': T(-10) }),
                state({}, { 'https://a': T(-200) }),
                opts,
            );
            expect(m.tombstones).toEqual({ 'https://a': T(-200), 'https://b': T(-10) });
        });

        it('garbage-collects old tombstones and keeps fresh ones', () => {
            const old = NOW - RL_TOMBSTONE_GC_MS - 1;
            const fresh = NOW - RL_TOMBSTONE_GC_MS + 1000;
            const m = mergeReadingListState(state({}, { 'https://old': old, 'https://new': fresh }), state(), opts);
            expect(m.tombstones).toEqual({ 'https://new': fresh });
        });

        it('honours a custom gcMs', () => {
            const m = mergeReadingListState(state({}, { 'https://a': T(-5000) }), state(), { now: NOW, gcMs: 1000 });
            expect(m.tombstones).toEqual({});
        });

        it('AC-4.02: delete on A, mark-read on B before pull stays deleted on both after merging both ways', () => {
            // B's edit (updatedAt 100) happened BEFORE A's delete (deletedAt 200).
            const A = state({}, { 'https://a': T(200) });
            const B = state({ 'https://a': entry({ hasBeenRead: true, updatedAt: T(100) }) });
            const onA = mergeReadingListState(A, B, opts);
            const onB = mergeReadingListState(B, A, opts);
            expect(onA.entries['https://a']).toBeUndefined();
            expect(onB.entries['https://a']).toBeUndefined();
            expect(readingListStateEqual(onA, onB)).toBe(true);
        });

        it('tolerates null / undefined / malformed inputs', () => {
            const m = mergeReadingListState(null, undefined, opts);
            expect(m).toEqual({ schema: 1, entries: {}, tombstones: {} });
        });

        it('does not mutate its inputs', () => {
            const a = state({ 'https://a': entry() }, { 'https://x': T(-1) });
            const b = state({ 'https://a': entry({ updatedAt: T(-1) }) });
            const snap = JSON.stringify([a, b]);
            mergeReadingListState(a, b, opts);
            expect(JSON.stringify([a, b])).toBe(snap);
        });
    });

    describe('convergence properties (seeded generator)', () => {
        function rng(seed) {
            let s = seed >>> 0;
            return () => {
                s = (s * 1664525 + 1013904223) >>> 0;
                return s / 2 ** 32;
            };
        }
        function gen(r) {
            const urls = ['https://a', 'https://b', 'https://c', 'https://d'];
            const entries = {};
            const tombstones = {};
            for (const u of urls) {
                const k = r();
                if (k < 0.45) {
                    entries[u] = {
                        title: r() < 0.5 ? 'x' : 'y',
                        hasBeenRead: r() < 0.5,
                        createdAt: Math.floor(r() * 5),
                        updatedAt: T(Math.floor(r() * 5)),
                    };
                } else if (k < 0.7) {
                    // Some tombstones are ancient so GC interacts with entries.
                    tombstones[u] = r() < 0.3 ? 1 : T(Math.floor(r() * 5));
                }
            }
            return state(entries, tombstones);
        }

        it('is commutative and idempotent across 300 random state pairs', () => {
            const r = rng(257);
            for (let i = 0; i < 300; i++) {
                const A = gen(r);
                const B = gen(r);
                const ab = mergeReadingListState(A, B, opts);
                const ba = mergeReadingListState(B, A, opts);
                expect(readingListStateEqual(ab, ba)).toBe(true);
                expect(readingListStateEqual(mergeReadingListState(ab, A, opts), ab)).toBe(true);
                expect(readingListStateEqual(mergeReadingListState(ab, B, opts), ab)).toBe(true);
                expect(readingListStateEqual(mergeReadingListState(ab, ab, opts), ab)).toBe(true);
            }
        });

        it('converges for three replicas in any grouping (ignoring createdAt, which a tombstone can mask)', () => {
            // createdAt = min over all *surviving* merges; an intermediate tombstone can hide
            // one side's createdAt, so strict associativity only holds for the other fields.
            const strip = (st) => JSON.stringify({
                ...st,
                entries: Object.fromEntries(Object.entries(st.entries).map(([u, e]) => [u, { ...e, createdAt: 0 }])),
            });
            const r = rng(99);
            for (let i = 0; i < 100; i++) {
                const A = gen(r), B = gen(r), C = gen(r);
                const l = mergeReadingListState(mergeReadingListState(A, B, opts), C, opts);
                const rr = mergeReadingListState(A, mergeReadingListState(B, C, opts), opts);
                expect(strip(l)).toBe(strip(rr));
            }
        });
    });

    describe('diffReadingList', () => {
        it('classifies add / update / remove, sorted by url', () => {
            const current = {
                'https://z-remove': { title: 'r', hasBeenRead: false },
                'https://b-same': { title: 's', hasBeenRead: false },
                'https://d-title': { title: 'old', hasBeenRead: false },
                'https://c-read': { title: 'c', hasBeenRead: false },
                'https://a-remove': { title: 'r', hasBeenRead: true },
            };
            const merged = state({
                'https://y-add': entry({ title: 'Y', hasBeenRead: true }),
                'https://x-add': entry({ title: 'X' }),
                'https://b-same': entry({ title: 's' }),
                'https://d-title': entry({ title: 'new' }),
                'https://c-read': entry({ title: 'c', hasBeenRead: true }),
            }, { 'https://z-remove': T(-1), 'https://a-remove': T(-1) });
            expect(diffReadingList(current, merged)).toEqual({
                add: [
                    { url: 'https://x-add', title: 'X', hasBeenRead: false },
                    { url: 'https://y-add', title: 'Y', hasBeenRead: true },
                ],
                update: [
                    { url: 'https://c-read', title: 'c', hasBeenRead: true },
                    { url: 'https://d-title', title: 'new', hasBeenRead: false },
                ],
                remove: ['https://a-remove', 'https://z-remove'],
            });
        });

        it('returns empty arrays when in sync or inputs are null', () => {
            const same = diffReadingList(
                { 'https://a': { title: 't', hasBeenRead: false } },
                state({ 'https://a': entry() }),
            );
            expect(same).toEqual({ add: [], update: [], remove: [] });
            expect(diffReadingList(null, null)).toEqual({ add: [], update: [], remove: [] });
        });
    });

    describe('diffReadingList — removal safety', () => {
        it('never removes a url that is merely absent from merged.entries (no tombstone)', () => {
            const d = diffReadingList({ 'https://lost': { title: 'x', hasBeenRead: false } }, state());
            expect(d.remove).toEqual([]);
        });

        it('removes a url only when it is tombstoned', () => {
            const d = diffReadingList(
                { 'https://gone': { title: 'x', hasBeenRead: false }, 'https://lost': { title: 'y', hasBeenRead: false } },
                state({}, { 'https://gone': T(-1) }),
            );
            expect(d.remove).toEqual(['https://gone']);
        });
    });

    describe('tombstoneTimestamp', () => {
        it('uses now when the wall clock is ahead of the entry Lamport time', () => {
            expect(tombstoneTimestamp(100, NOW)).toBe(NOW);
        });
        it('steps past updatedAt when now < prevUpdatedAt so the delete still wins', () => {
            const del = tombstoneTimestamp(NOW + 5000, NOW);
            expect(del).toBe(NOW + 5001);
            const m = mergeReadingListState(
                state({ 'https://a': entry({ updatedAt: NOW + 5000 }) }),
                state({}, { 'https://a': del }),
                opts,
            );
            expect(m.entries['https://a']).toBeUndefined();
        });
        it('treats missing prev as 0', () => {
            expect(tombstoneTimestamp(undefined, NOW)).toBe(NOW);
        });
        it('a re-add stamped with nextTimestamp(deletedAt, now) resurrects', () => {
            const deletedAt = tombstoneTimestamp(NOW + 5000, NOW);
            const reAdd = Math.max(NOW, deletedAt + 1); // nextTimestamp semantics
            const m = mergeReadingListState(
                state({ 'https://a': entry({ updatedAt: reAdd }) }),
                state({}, { 'https://a': deletedAt }),
                opts,
            );
            expect(m.entries['https://a']).toBeDefined();
            expect(m.tombstones['https://a']).toBeUndefined();
        });
    });

    describe('hardening and edge cases', () => {
        it('skips own __proto__ / constructor keys and does not pollute prototypes', () => {
            const payload = JSON.parse(
                '{"entries":{"__proto__":{"title":"p","updatedAt":5},"constructor":{"title":"c","updatedAt":5},"https://a":{"title":"a","updatedAt":5}},' +
                '"tombstones":{"__proto__":9,"constructor":9}}',
            );
            const c = canonicalizeReadingListState(payload);
            expect(Object.keys(c.entries)).toEqual(['https://a']);
            expect(Object.keys(c.tombstones)).toEqual([]);
            expect(Object.getPrototypeOf(c.entries)).toBe(Object.prototype);
            const m = mergeReadingListState(payload, payload, opts);
            expect(Object.keys(m.entries)).toEqual(['https://a']);
            const cur = JSON.parse('{"__proto__":{"title":"x","hasBeenRead":false}}');
            const d = diffReadingList(cur, m);
            expect(d.remove).toEqual([]);
            expect(d.add.map((e) => e.url)).toEqual(['https://a']);
        });

        it('tombstone deletedAt 0 excludes a seeded updatedAt 0 entry (delete is at least as new)', () => {
            const m = mergeReadingListState(
                state({ 'https://a': entry({ updatedAt: 0, createdAt: 0 }) }),
                state({}, { 'https://a': 0 }),
                { now: 0 },
            );
            expect(m.entries['https://a']).toBeUndefined();
        });

        it('AC-4.01: applying the diff and re-exporting yields no echo', () => {
            const local = state({ 'https://old': entry({ updatedAt: T(-9) }) });
            const remote = state({ 'https://new': entry({ title: 'N', updatedAt: T(-5) }) }, { 'https://old': T(-3) });
            const merged = mergeReadingListState(local, remote, opts);
            const current = { 'https://old': { title: 't', hasBeenRead: false } };
            const d = diffReadingList(current, merged);
            const applied = { ...current };
            d.remove.forEach((u) => delete applied[u]);
            [...d.add, ...d.update].forEach((e) => { applied[e.url] = { title: e.title, hasBeenRead: e.hasBeenRead }; });
            // Re-export: sidecar keeps merged's updatedAt (no bump).
            const reExport = state(
                Object.fromEntries(Object.entries(applied).map(([u, v]) => [u, { ...merged.entries[u], ...v }])),
                merged.tombstones,
            );
            expect(readingListStateEqual(mergeReadingListState(reExport, merged, opts), merged)).toBe(true);
            expect(diffReadingList(applied, merged)).toEqual({ add: [], update: [], remove: [] });
        });

        it('throws TypeError when now is not a finite number', () => {
            for (const bad of [undefined, NaN, Infinity, '5', null]) {
                expect(() => mergeReadingListState(state(), state(), { now: bad })).toThrow(TypeError);
            }
            expect(() => mergeReadingListState(state(), state())).toThrow(TypeError);
        });
    });

    describe('canonicalizeReadingListState', () => {
        it('drops bad records, coerces fields, sorts keys, and never mutates input', () => {
            const input = {
                schema: 1,
                entries: {
                    'https://z': { title: 5, hasBeenRead: 1, updatedAt: 10 },
                    'https://a': { title: 'A', hasBeenRead: false, createdAt: 3, updatedAt: 7 },
                    '': { title: 'empty', hasBeenRead: false, updatedAt: 1 },
                    'https://nan': { title: 'n', updatedAt: NaN },
                    'https://neg': { title: 'n', updatedAt: -1 },
                    'https://str': { title: 'n', updatedAt: '5' },
                    'https://null': null,
                },
                tombstones: { 'https://t2': 5, 'https://t1': 2, 'https://bad': 'x', 'https://neg': -3, 'https://inf': Infinity },
            };
            const snap = JSON.stringify(input);
            const c = canonicalizeReadingListState(input);
            expect(JSON.stringify(input)).toBe(snap);
            expect(Object.keys(c.entries)).toEqual(['https://a', 'https://z']);
            expect(c.entries['https://z']).toEqual({ title: '5', hasBeenRead: true, createdAt: 10, updatedAt: 10 });
            expect(Object.keys(c.tombstones)).toEqual(['https://t1', 'https://t2']);
            expect(c.schema).toBe(RL_SYNC_SCHEMA);
        });

        it('tolerates null / undefined / non-object', () => {
            const empty = { schema: 1, entries: {}, tombstones: {} };
            expect(canonicalizeReadingListState(null)).toEqual(empty);
            expect(canonicalizeReadingListState(undefined)).toEqual(empty);
            expect(canonicalizeReadingListState('x')).toEqual(empty);
        });

        it('defaults title to empty string', () => {
            const c = canonicalizeReadingListState({ entries: { 'https://a': { updatedAt: 1 } } });
            expect(c.entries['https://a'].title).toBe('');
        });
    });

    describe('readingListStateEqual', () => {
        it('ignores key order and junk, detects real differences', () => {
            const a = state({ 'https://a': entry(), 'https://b': entry() });
            const b = state({ 'https://b': entry(), 'https://a': entry() });
            expect(readingListStateEqual(a, b)).toBe(true);
            expect(readingListStateEqual(a, state({ 'https://a': entry() }))).toBe(false);
            expect(readingListStateEqual(a, state({ 'https://a': entry(), 'https://b': entry({ hasBeenRead: true }) }))).toBe(false);
            expect(readingListStateEqual(state({}, { 'https://a': 1 }), state())).toBe(false);
        });
    });

    describe('isReadingListSchemaTooNew', () => {
        it('is true only for numeric schema greater than the supported one', () => {
            expect(isReadingListSchemaTooNew({ schema: 2 })).toBe(true);
            expect(isReadingListSchemaTooNew({ schema: 1 })).toBe(false);
            expect(isReadingListSchemaTooNew({ schema: 0 })).toBe(false);
            expect(isReadingListSchemaTooNew({ schema: '9' })).toBe(false);
            expect(isReadingListSchemaTooNew({})).toBe(false);
            expect(isReadingListSchemaTooNew(null)).toBe(false);
        });
    });
});
