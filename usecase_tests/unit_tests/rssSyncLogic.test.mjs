import {
    RSS_SYNC_SCHEMA,
    MAX_STORED_HASHES,
    TOMBSTONE_GC_MS,
    nextTimestamp,
    capHashes,
    mergeHashesForWrite,
    mergeSubscriptions,
    mergeRssState,
    canonicalizeRssState,
    rssStateEqual,
} from '../../modules/rss/rssSyncLogic.js';

const NOW = 1_700_000_000_000; // fixed clock for deterministic tests
const T = (delta) => NOW + delta; // timestamps near NOW so tombstones aren't GC'd

const sub = (id, over = {}) => ({
    id,
    url: `https://feeds.example/${id}`,
    title: id,
    interval: '24h',
    enabled: true,
    lastFetched: 0,
    updatedAt: 0,
    ...over,
});

describe('rssSyncLogic — pure RSS Drive-sync merge', () => {
    describe('nextTimestamp — Lamport-lite monotonicity', () => {
        it('uses now when now is ahead of known', () => {
            expect(nextTimestamp(100, NOW)).toBe(NOW);
        });

        it('steps past a known future timestamp when the wall clock runs backwards', () => {
            // Device clock lags: now < known. Must still advance beyond known.
            expect(nextTimestamp(NOW, NOW - 10_000)).toBe(NOW + 1);
        });

        it('treats missing known as 0', () => {
            expect(nextTimestamp(undefined, NOW)).toBe(NOW);
        });
    });

    describe('capHashes / mergeHashesForWrite', () => {
        it('dedups and preserves everything under the cap', () => {
            expect(capHashes(['a', 'b', 'a', 'c'], 10).sort()).toEqual(['a', 'b', 'c']);
        });

        it('caps deterministically regardless of input order (convergence at the cap)', () => {
            const many = Array.from({ length: 20 }, (_, i) => `h${String(i).padStart(2, '0')}`);
            const a = capHashes(many, 5);
            const b = capHashes([...many].reverse(), 5);
            expect(a).toEqual(b);
            expect(a.length).toBe(5);
        });

        it('REGRESSION: a stale in-memory snapshot cannot clobber hashes another context wrote', () => {
            // Bug: saveFetchedHashes blindly wrote Array.from(staleSet), deleting
            // hashes a sibling context had persisted. The fix unions storage.
            const storageNow = ['swAdded1', 'swAdded2', 'shared'];
            const staleInMemory = new Set(['shared']); // panel opened before SW wrote
            const merged = mergeHashesForWrite(storageNow, staleInMemory, 5000);
            expect(merged.sort()).toEqual(['shared', 'swAdded1', 'swAdded2']);
        });
    });

    describe('mergeSubscriptions', () => {
        it('unions by id', () => {
            const { subscriptions } = mergeSubscriptions(
                [sub('a')], [sub('b')], {}, {}, NOW, TOMBSTONE_GC_MS,
            );
            expect(subscriptions.map((s) => s.id)).toEqual(['a', 'b']);
        });

        it('resolves same-id conflicts by larger updatedAt (last edit wins)', () => {
            const local = [sub('a', { interval: '1h', updatedAt: T(0) })];
            const remote = [sub('a', { interval: '24h', updatedAt: T(-1000) })];
            const { subscriptions } = mergeSubscriptions(local, remote, {}, {}, NOW, TOMBSTONE_GC_MS);
            expect(subscriptions[0].interval).toBe('1h');
        });

        it('takes the max lastFetched regardless of which record wins the edit', () => {
            const local = [sub('a', { updatedAt: T(0), lastFetched: 100 })];
            const remote = [sub('a', { updatedAt: T(-1), lastFetched: 999 })];
            const { subscriptions } = mergeSubscriptions(local, remote, {}, {}, NOW, TOMBSTONE_GC_MS);
            expect(subscriptions[0].lastFetched).toBe(999);
        });

        it('hides a subscription when a tombstone is at least as new as its last edit', () => {
            const local = [sub('a', { updatedAt: T(-500) })];
            const { subscriptions } = mergeSubscriptions(local, [], { a: T(-500) }, {}, NOW, TOMBSTONE_GC_MS);
            expect(subscriptions).toEqual([]);
        });

        it('resurrects a subscription re-edited AFTER the deletion (updatedAt > deletedAt)', () => {
            const local = [sub('a', { updatedAt: T(-400) })];
            const { subscriptions } = mergeSubscriptions(local, [], { a: T(-500) }, {}, NOW, TOMBSTONE_GC_MS);
            expect(subscriptions.map((s) => s.id)).toEqual(['a']);
        });

        it('unions tombstones keeping the latest deletion time', () => {
            const { tombstones } = mergeSubscriptions([], [], { a: T(-200) }, { a: T(-100) }, NOW, TOMBSTONE_GC_MS);
            expect(tombstones.a).toBe(T(-100));
        });

        it('GCs tombstones older than the grace window', () => {
            const old = NOW - TOMBSTONE_GC_MS - 1;
            const { tombstones } = mergeSubscriptions([], [], { a: old }, {}, NOW, TOMBSTONE_GC_MS);
            expect(tombstones.a).toBeUndefined();
        });
    });

    describe('mergeRssState — convergence properties', () => {
        const A = {
            subscriptions: [sub('a', { updatedAt: T(-100) }), sub('b', { updatedAt: T(-80), lastFetched: 5 })],
            tombstones: { z: T(-100) },
            hashes: ['h1', 'h2', 'h3'],
        };
        const B = {
            subscriptions: [sub('b', { updatedAt: T(-75), lastFetched: 9 }), sub('c', { updatedAt: T(-70) })],
            tombstones: { a: T(-50) },
            hashes: ['h3', 'h4'],
        };
        const opts = { now: NOW };

        it('is commutative: merge(A,B) ≡ merge(B,A)', () => {
            expect(rssStateEqual(mergeRssState(A, B, opts), mergeRssState(B, A, opts))).toBe(true);
        });

        it('is idempotent: merge(merge(A,B),A) ≡ merge(A,B)', () => {
            const ab = mergeRssState(A, B, opts);
            expect(rssStateEqual(mergeRssState(ab, A, opts), ab)).toBe(true);
        });

        it('stamps the schema version', () => {
            expect(mergeRssState(A, B, opts).schema).toBe(RSS_SYNC_SCHEMA);
        });

        it('the tombstone on "a" (deletedAt 50 >= updatedAt 10) removes it from the union', () => {
            const merged = mergeRssState(A, B, opts);
            expect(merged.subscriptions.map((s) => s.id)).toEqual(['b', 'c']);
        });

        it('stays commutative AND idempotent even when hashes exceed the cap', () => {
            const cap = 8;
            const mk = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, '0')}`);
            const P = { subscriptions: [], tombstones: {}, hashes: mk('p', 10) };
            const Q = { subscriptions: [], tombstones: {}, hashes: mk('q', 10) };
            const o = { now: NOW, hashCap: cap };
            const pq = mergeRssState(P, Q, o);
            expect(pq.hashes.length).toBe(cap);
            expect(rssStateEqual(pq, mergeRssState(Q, P, o))).toBe(true);       // commutative
            expect(rssStateEqual(mergeRssState(pq, P, o), pq)).toBe(true);      // idempotent
        });
    });

    describe('canonicalizeRssState / rssStateEqual', () => {
        it('ignores subscription and hash ordering', () => {
            const one = { subscriptions: [sub('a'), sub('b')], tombstones: {}, hashes: ['x', 'y'] };
            const two = { subscriptions: [sub('b'), sub('a')], tombstones: {}, hashes: ['y', 'x'] };
            expect(rssStateEqual(one, two)).toBe(true);
        });

        it('detects a genuine difference', () => {
            const one = { subscriptions: [sub('a')], tombstones: {}, hashes: [] };
            const two = { subscriptions: [sub('a', { interval: '1h' })], tombstones: {}, hashes: [] };
            expect(rssStateEqual(one, two)).toBe(false);
        });
    });

    it('exports the expected constants', () => {
        expect(MAX_STORED_HASHES).toBe(5000);
        expect(TOMBSTONE_GC_MS).toBe(180 * 24 * 60 * 60 * 1000);
    });
});
