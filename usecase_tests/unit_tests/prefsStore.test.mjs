/**
 * ISSUE-257 WP3 — per-key preference store in chrome.storage.local.
 *
 * Each managed preference is its own record `pref_<name> = { v, t }` (value +
 * app-controlled Lamport timestamp travel together; per-key records avoid the
 * multi-context whole-object lost-update of ISSUE-162). Defaults are NEVER
 * materialised: a missing record means "no claim" so a fresh device cannot
 * out-vote a real value seeded at t=0 elsewhere (SA §3.3 invariant).
 */
import {
    PREF_DEFS,
    PREF_KEY_PREFIX,
    PREFS_MIGRATED_KEY,
    prefStorageKey,
    isPrefStorageKey,
    prefNameFromKey,
    createPrefsStore,
} from '../../modules/prefs/prefsStore.js';

function fakeAreas() {
    const data = { local: {}, sync: {} };
    const writes = { local: 0, sync: 0 };
    const clone = (v) => JSON.parse(JSON.stringify(v));
    return {
        data,
        writes,
        storage: {
            get: async (area, keys) => {
                const out = {};
                const arr = Array.isArray(keys) ? keys : [keys];
                for (const k of arr) if (k in data[area]) out[k] = clone(data[area][k]);
                return out;
            },
            set: async (area, items) => { writes[area] += 1; for (const [k, v] of Object.entries(items)) data[area][k] = clone(v); },
            remove: async (area, keys) => { for (const k of [].concat(keys)) delete data[area][k]; },
        },
    };
}

function build(now = 1000) {
    const areas = fakeAreas();
    let clock = now;
    const store = createPrefsStore({ storage: areas.storage, now: () => clock });
    return { store, areas, setClock: (t) => { clock = t; } };
}

describe('key helpers', () => {
    it('maps names to storage keys and back', () => {
        expect(PREF_KEY_PREFIX).toBe('pref_');
        expect(prefStorageKey('theme')).toBe('pref_theme');
        expect(isPrefStorageKey('pref_theme')).toBe(true);
        expect(isPrefStorageKey('theme')).toBe(false);
        expect(isPrefStorageKey('wsMeta_1')).toBe(false);
        expect(prefNameFromKey('pref_listDensity')).toBe('listDensity');
    });

    it('declares defaults for the 19 managed preferences', () => {
        expect(Object.keys(PREF_DEFS)).toHaveLength(19);
        expect(PREF_DEFS.theme.def).toBe('geek');
        expect(PREF_DEFS.autoArchiveIdleHours.def).toBe(12);
        expect(PREF_DEFS.readingListSortOrder.def).toBe('date-newest');
    });
});

describe('getPref / setPref', () => {
    it('returns the default when no record exists and writes nothing', async () => {
        const { store, areas } = build();
        expect(await store.getPref('theme')).toBe('geek');
        expect(await store.getPref('readingListVisible')).toBe(true);
        expect(areas.writes.local).toBe(0);
        expect(areas.data.local.pref_theme).toBeUndefined();
    });

    it('setPref stores { v, t } with t from the clock and getPref returns a copy', async () => {
        const { store, areas } = build(5000);
        await store.setPref('theme', 'ocean');
        expect(areas.data.local.pref_theme).toEqual({ v: 'ocean', t: 5000 });
        expect(await store.getPref('theme')).toBe('ocean');
        const order = await store.setPref('sectionOrder', ['a', 'b']).then(() => store.getPref('sectionOrder'));
        order.push('c');
        expect(await store.getPref('sectionOrder')).toEqual(['a', 'b']);
    });

    it('t is monotonic even when the wall clock runs backwards', async () => {
        const { store, areas, setClock } = build(5000);
        await store.setPref('theme', 'a');
        setClock(4000);
        await store.setPref('theme', 'b');
        expect(areas.data.local.pref_theme.t).toBe(5001);
    });

    it('rejects unknown preference names', async () => {
        const { store } = build();
        await expect(store.setPref('driveWebAuth', { accessToken: 'x' })).rejects.toThrow(/unknown pref/);
        expect(await store.getPref('nope')).toBeUndefined();
    });

    it('getPrefs reads several at once, mixing records and defaults', async () => {
        const { store } = build();
        await store.setPref('listDensity', 'compact');
        expect(await store.getPrefs(['theme', 'listDensity'])).toEqual({ theme: 'geek', listDensity: 'compact' });
    });
});

describe('ensureMigrated (one-time seed from storage.sync)', () => {
    it('seeds only keys actually present in sync, at t=0, then sets the flag', async () => {
        const { store, areas } = build();
        areas.data.sync.theme = 'custom';
        areas.data.sync.customTheme = { primary: '#000' };
        areas.data.sync.listDensity = 'compact';
        await store.ensureMigrated();
        expect(areas.data.local.pref_theme).toEqual({ v: 'custom', t: 0 });
        expect(areas.data.local.pref_customTheme).toEqual({ v: { primary: '#000' }, t: 0 });
        expect(areas.data.local.pref_listDensity).toEqual({ v: 'compact', t: 0 });
        expect(areas.data.local.pref_uiLanguage).toBeUndefined(); // default, never materialised
        expect(areas.data.local[PREFS_MIGRATED_KEY]).toBe(true);
    });

    it('never overwrites an existing local record and never re-seeds once flagged', async () => {
        const { store, areas } = build(9000);
        areas.data.local.pref_theme = { v: 'ocean', t: 9000 };
        areas.data.sync.theme = 'geek';
        areas.data.sync.listDensity = 'compact';
        await store.ensureMigrated();
        expect(areas.data.local.pref_theme).toEqual({ v: 'ocean', t: 9000 });
        areas.data.sync.uiLanguage = 'ja'; // arrives later via native sync from an old device
        await store.ensureMigrated();
        expect(areas.data.local.pref_uiLanguage).toBeUndefined();
    });

    it('does not delete the legacy sync keys (old devices still read them)', async () => {
        const { store, areas } = build();
        areas.data.sync.theme = 'custom';
        await store.ensureMigrated();
        expect(areas.data.sync.theme).toBe('custom');
    });

    it('is single-flight: concurrent calls seed once', async () => {
        const { store, areas } = build();
        areas.data.sync.theme = 'custom';
        await Promise.all([store.ensureMigrated(), store.ensureMigrated()]);
        expect(areas.writes.local).toBe(2); // one batch of records + the flag
    });
});

describe('exportState / importMerged', () => {
    it('exports only existing records (no defaults) with schema 1', async () => {
        const { store } = build(7);
        await store.setPref('theme', 'ocean');
        expect(await store.exportState()).toEqual({ schema: 1, entries: { theme: { v: 'ocean', t: 7 } } });
    });

    it('importMerged writes only records that differ and ignores non-allowlisted names', async () => {
        const { store, areas } = build(7);
        await store.setPref('theme', 'ocean');
        const written = await store.importMerged({
            theme: { v: 'ocean', t: 7 },                  // identical → skip
            listDensity: { v: 'compact', t: 3 },          // new → write
            driveWebAuth: { v: { accessToken: 'x' }, t: 9 }, // not a pref → ignore
        });
        expect(written).toEqual(['listDensity']);
        expect(areas.data.local.pref_listDensity).toEqual({ v: 'compact', t: 3 });
        expect(areas.data.local.pref_driveWebAuth).toBeUndefined();
    });

    it('importMerged adopts the remote t verbatim (no bump → no echo push)', async () => {
        const { store, areas } = build(100);
        await store.importMerged({ theme: { v: 'light', t: 42 } });
        expect(areas.data.local.pref_theme).toEqual({ v: 'light', t: 42 });
    });
});


describe('review round 1 (ISSUE-257 WP3)', () => {
    it('setPref with the same value writes nothing and does not bump t', async () => {
        const { store, areas } = build(5000);
        await store.setPref('customTheme', { b: 2, a: 1 });
        const writes = areas.writes.local;
        await store.setPref('customTheme', { a: 1, b: 2 }); // same value, different key order
        expect(areas.writes.local).toBe(writes);
        expect(areas.data.local.pref_customTheme.t).toBe(5000);
    });

    it('a failing storage.sync read leaves prefs readable (defaults / local records) and sets no flag', async () => {
        const areas = fakeAreas();
        const realGet = areas.storage.get;
        areas.storage.get = async (area, keys) => { if (area === 'sync') throw new Error('sync unavailable'); return realGet(area, keys); };
        const store = createPrefsStore({ storage: areas.storage, now: () => 1 });
        await store.setPref('theme', 'ocean');
        expect(await store.getPref('theme')).toBe('ocean');
        expect(await store.getPref('listDensity')).toBe('cozy');
        await store.ensureMigrated();
        expect(areas.data.local[PREFS_MIGRATED_KEY]).toBeUndefined();
    });

    it('a sync read that resolves undefined is treated as empty', async () => {
        const areas = fakeAreas();
        const realGet = areas.storage.get;
        areas.storage.get = async (area, keys) => (area === 'sync' ? undefined : realGet(area, keys));
        const store = createPrefsStore({ storage: areas.storage, now: () => 1 });
        await store.ensureMigrated();
        expect(areas.data.local[PREFS_MIGRATED_KEY]).toBe(true);
        expect(await store.getPref('theme')).toBe('geek');
    });

    it('importMerged treats key-order-only differences as equal (no rewrite)', async () => {
        const { store, areas } = build(7);
        await store.setPref('customTheme', { b: 2, a: 1 });
        const writes = areas.writes.local;
        const written = await store.importMerged({ customTheme: { v: { a: 1, b: 2 }, t: 7 } });
        expect(written).toEqual([]);
        expect(areas.writes.local).toBe(writes);
    });
});
