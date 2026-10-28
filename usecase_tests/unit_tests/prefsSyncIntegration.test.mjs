/**
 * ISSUE-257 WP3 — two devices converge through Drive's settings-sync.json.
 *
 * Exercises the real pieces end-to-end in Node: two independent prefsStores
 * (fake storage areas per device), the in-memory fake SyncProvider, and the
 * runPrefsSync orchestration that background.js calls from prefsSyncOnce.
 */
import { createPrefsStore } from '../../modules/prefs/prefsStore.js';
import { runPrefsSync, PREFS_SYNC_FILE } from '../../modules/prefs/prefsSync.js';
import { createFakeSyncProvider } from '../../modules/sync/syncProvider.js';

function device(now0 = 1000) {
    const data = { local: {}, sync: {} };
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const writes = { local: 0 };
    let clock = now0;
    const storage = {
        get: async (area, keys) => { const out = {}; for (const k of [].concat(keys)) if (k in data[area]) out[k] = clone(data[area][k]); return out; },
        set: async (area, items) => { if (area === 'local') writes.local += 1; for (const [k, v] of Object.entries(items)) data[area][k] = clone(v); },
        remove: async (area, keys) => { for (const k of [].concat(keys)) delete data[area][k]; },
    };
    const store = createPrefsStore({ storage, now: () => clock });
    return { store, data, writes, tick: (n) => { clock += n; } };
}

describe('runPrefsSync — cross-device convergence', () => {
    it('A changes theme → B pulls it, and B does not push anything back (no echo)', async () => {
        const provider = createFakeSyncProvider();
        const A = device(1000); const B = device(2000);
        await A.store.setPref('theme', 'ocean');
        await runPrefsSync({ provider, store: A.store });
        const afterA = (await provider.read(PREFS_SYNC_FILE)).version;

        await runPrefsSync({ provider, store: B.store });
        expect(await B.store.getPref('theme')).toBe('ocean');
        expect((await provider.read(PREFS_SYNC_FILE)).version).toBe(afterA); // B wrote nothing
        // A second run on B is a complete no-op (no local write, no remote write).
        const localWrites = B.writes.local;
        await runPrefsSync({ provider, store: B.store });
        expect(B.writes.local).toBe(localWrites);
        expect((await provider.read(PREFS_SYNC_FILE)).version).toBe(afterA);
    });

    it('offline edits of different keys on both devices are both kept', async () => {
        const provider = createFakeSyncProvider();
        const A = device(1000); const B = device(1000);
        await A.store.setPref('theme', 'ocean');
        await B.store.setPref('listDensity', 'compact');
        await runPrefsSync({ provider, store: A.store });
        await runPrefsSync({ provider, store: B.store });
        await runPrefsSync({ provider, store: A.store });
        expect(await A.store.getPrefs(['theme', 'listDensity'])).toEqual({ theme: 'ocean', listDensity: 'compact' });
        expect(await B.store.getPrefs(['theme', 'listDensity'])).toEqual({ theme: 'ocean', listDensity: 'compact' });
    });

    it('a fresh device with only defaults adopts the remote values instead of out-voting them', async () => {
        const provider = createFakeSyncProvider();
        const A = device(1000); const fresh = device(5000);
        A.data.sync.listDensity = 'compact';      // legacy value seeded at t=0
        await A.store.ensureMigrated();
        await runPrefsSync({ provider, store: A.store });
        expect(await fresh.store.getPref('listDensity')).toBe('cozy'); // default before sync
        await runPrefsSync({ provider, store: fresh.store });
        expect(await fresh.store.getPref('listDensity')).toBe('compact');
    });

    it('the newer edit wins the same key across devices', async () => {
        const provider = createFakeSyncProvider();
        const A = device(1000); const B = device(1000);
        await A.store.setPref('theme', 'a-first');
        await runPrefsSync({ provider, store: A.store });
        await runPrefsSync({ provider, store: B.store });
        B.tick(500);
        await B.store.setPref('theme', 'b-later');
        await runPrefsSync({ provider, store: B.store });
        await runPrefsSync({ provider, store: A.store });
        expect(await A.store.getPref('theme')).toBe('b-later');
    });

    it('never overwrites a remote file with a newer schema, but still imports what it understands', async () => {
        const provider = createFakeSyncProvider();
        await provider.write(PREFS_SYNC_FILE, { schema: 99, entries: { theme: { v: 'future', t: 10 } } });
        const A = device(1000);
        await runPrefsSync({ provider, store: A.store });
        expect(await A.store.getPref('theme')).toBe('future');
        expect((await provider.read(PREFS_SYNC_FILE)).json.schema).toBe(99);
    });

    it('does nothing when the provider is not connected', async () => {
        const provider = createFakeSyncProvider({ connected: false });
        const A = device(1000);
        await A.store.setPref('theme', 'ocean');
        await runPrefsSync({ provider, store: A.store });
        expect(await provider.read(PREFS_SYNC_FILE)).toBeNull();
    });
});
