import {
    pickNewer,
    mergeNewswireConfig,
    mergeKeys,
    mergeNewswireState,
    buildNewswirePayload,
    canonicalizeNewswire,
    NEWSWIRE_SYNC_SCHEMA,
} from '../../modules/newswire/newswireSyncLogic.js';

const cfg = (over = {}) => ({
    schemaVersion: 1,
    sources: {
        tree: { enabled: false, updatedAt: 10 },
        fj: { enabled: false, updatedAt: 10 },
        alpaca: { enabled: false, updatedAt: 10 },
        jin10: { enabled: false, mode: 'wss', categories: ['1'], updatedAt: 10 },
    },
    rules: { p0: ['CPI'], p1: ['TSMC'], mute: [], updatedAt: 10 },
    prefs: { notificationsEnabled: true, syncKeys: false, updatedAt: 10 },
    ...over,
});

describe('newswireSyncLogic (BASE-016 N3)', () => {
    describe('pickNewer', () => {
        it('larger updatedAt wins; null-safe', () => {
            expect(pickNewer({ v: 1, updatedAt: 5 }, { v: 2, updatedAt: 9 })).toEqual({ v: 2, updatedAt: 9 });
            expect(pickNewer(null, { v: 2, updatedAt: 9 })).toEqual({ v: 2, updatedAt: 9 });
            expect(pickNewer({ v: 1, updatedAt: 5 }, null)).toEqual({ v: 1, updatedAt: 5 });
            expect(pickNewer(null, null)).toBeNull();
        });
        it('equal updatedAt → deterministic, order-independent tiebreak', () => {
            const a = { v: 'a', updatedAt: 5 };
            const b = { v: 'b', updatedAt: 5 };
            expect(pickNewer(a, b)).toEqual(pickNewer(b, a));
        });
    });

    describe('mergeNewswireConfig — per-group LWW', () => {
        it('takes the newer of each source independently', () => {
            const local = cfg();
            const remote = cfg({
                sources: { ...cfg().sources, fj: { enabled: true, updatedAt: 20 } },
            });
            const merged = mergeNewswireConfig(local, remote);
            expect(merged.sources.fj).toEqual({ enabled: true, updatedAt: 20 }); // remote newer
            expect(merged.sources.tree).toEqual({ enabled: false, updatedAt: 10 }); // unchanged
        });
        it('rules and prefs merge as whole groups by updatedAt', () => {
            const local = cfg({ rules: { p0: ['CPI', 'NFP'], p1: [], mute: [], updatedAt: 30 } });
            const remote = cfg({ rules: { p0: ['old'], p1: [], mute: [], updatedAt: 20 } });
            expect(mergeNewswireConfig(local, remote).rules.p0).toEqual(['CPI', 'NFP']);
        });
        it('preserves unknown source ids (forward compat)', () => {
            const remote = cfg({ sources: { ...cfg().sources, benzinga: { enabled: true, updatedAt: 5 } } });
            expect(mergeNewswireConfig(cfg(), remote).sources.benzinga).toEqual({ enabled: true, updatedAt: 5 });
        });
        it('is commutative', () => {
            const a = cfg({ prefs: { notificationsEnabled: false, syncKeys: true, updatedAt: 40 } });
            const b = cfg();
            expect(canonicalizeNewswire(mergeNewswireConfig(a, b)))
                .toBe(canonicalizeNewswire(mergeNewswireConfig(b, a)));
        });
    });

    describe('mergeNewswireState — key opt-in (FR-20)', () => {
        it('syncKeys OFF: local keys untouched, remote payload scrubbed (no keys)', () => {
            const local = { config: cfg(), keys: { fj: { apiKey: 'local-k' }, updatedAt: 5 } };
            const remote = { config: cfg(), keys: { fj: { apiKey: 'remote-k' }, updatedAt: 9 } };
            const merged = mergeNewswireState(local, remote);
            expect(merged.localKeys).toEqual({ fj: { apiKey: 'local-k' }, updatedAt: 5 }); // untouched
            expect(merged.remoteKeys).toBeUndefined(); // scrub
        });
        it('syncKeys ON: keys LWW into both local and remote', () => {
            const on = cfg({ prefs: { notificationsEnabled: true, syncKeys: true, updatedAt: 50 } });
            const local = { config: on, keys: { fj: { apiKey: 'local-k' }, updatedAt: 5 } };
            const remote = { config: on, keys: { fj: { apiKey: 'remote-k' }, updatedAt: 9 } };
            const merged = mergeNewswireState(local, remote);
            expect(merged.localKeys).toEqual({ fj: { apiKey: 'remote-k' }, updatedAt: 9 }); // remote newer
            expect(merged.remoteKeys).toEqual(merged.localKeys);
        });
        it('turning opt-in OFF wins if its prefs.updatedAt is newest → scrub', () => {
            const localOff = { config: cfg({ prefs: { notificationsEnabled: true, syncKeys: false, updatedAt: 99 } }), keys: { fj: { apiKey: 'k' }, updatedAt: 5 } };
            const remoteOn = { config: cfg({ prefs: { notificationsEnabled: true, syncKeys: true, updatedAt: 50 } }), keys: { fj: { apiKey: 'k' }, updatedAt: 5 } };
            const merged = mergeNewswireState(localOff, remoteOn);
            expect(merged.config.prefs.syncKeys).toBe(false);
            expect(merged.remoteKeys).toBeUndefined();
        });
    });

    describe('buildNewswirePayload', () => {
        it('includes keys only when remoteKeys defined', () => {
            const base = { config: cfg(), remoteKeys: undefined };
            expect(buildNewswirePayload(base, 123)).toEqual({ schemaVersion: 1, config: cfg(), updatedAt: 123 });
            const withKeys = { config: cfg(), remoteKeys: { fj: { apiKey: 'k' }, updatedAt: 5 } };
            expect(buildNewswirePayload(withKeys, 123).keys).toEqual({ fj: { apiKey: 'k' }, updatedAt: 5 });
        });
    });

    describe('canonicalizeNewswire — no-op guard', () => {
        it('order-independent for object keys, order-preserving for arrays', () => {
            expect(canonicalizeNewswire({ b: 1, a: 2 })).toBe(canonicalizeNewswire({ a: 2, b: 1 }));
            expect(canonicalizeNewswire({ p0: ['A', 'B'] })).not.toBe(canonicalizeNewswire({ p0: ['B', 'A'] }));
        });
        it('idempotent merge: re-merging a converged state changes nothing', () => {
            const local = { config: cfg(), keys: {} };
            const remote = { config: cfg(), keys: {} };
            const m1 = mergeNewswireState(local, remote);
            const m2 = mergeNewswireState({ config: m1.config, keys: m1.localKeys }, { config: m1.config, keys: m1.remoteKeys });
            expect(canonicalizeNewswire(m1.config)).toBe(canonicalizeNewswire(m2.config));
        });
        it('schema constant is exported', () => {
            expect(NEWSWIRE_SYNC_SCHEMA).toBe(1);
        });
    });
});
