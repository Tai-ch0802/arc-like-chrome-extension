/**
 * @file prefsStore.js
 * Per-key preference store in chrome.storage.local (ISSUE-257 WP3).
 *
 * Why not chrome.storage.sync any more: it only syncs between Google Chrome
 * profiles signed into the same Google account. Dia (and every other Chromium
 * brand) has no such backend, so preferences could never cross browsers. The
 * working copy now lives in storage.local, one record per preference
 * (`pref_<name> = { v, t }`) and Google Drive's `settings-sync.json` is the
 * cross-device source of truth (see modules/prefs/prefsSyncLogic.js).
 *
 * Design rules (SA §3.3):
 * - One record per key, value and app-controlled Lamport timestamp together:
 *   sidepanel / options / SW write different keys concurrently and a single
 *   bundle would reintroduce ISSUE-162's whole-object lost-update.
 * - Defaults are NEVER written as records. A missing record is "no claim", so
 *   a fresh device's default cannot out-vote a real value seeded at t=0 on
 *   another device. `getPref` returns the default from PREF_DEFS instead.
 * - One-time migration seeds only the keys actually present in storage.sync
 *   (t=0, so any real edit wins) and never deletes the legacy sync keys —
 *   deleting would propagate through native sync and wipe not-yet-upgraded
 *   devices (BASE-014 §3.4 precedent).
 *
 * The store is dependency-injected (storage + clock) for Node tests; the
 * default instance below wires apiManager's storage wrappers.
 */
import { getStorage, setStorage, removeStorage } from '../apiManager.js';
import { nextTimestamp } from '../utils/lamportClock.js';
import { PREFS_SYNC_SCHEMA, filterToAllowlist } from './prefsSyncLogic.js';

export const PREF_KEY_PREFIX = 'pref_';
/** storage.local flag: the one-time seed from storage.sync has run. */
export const PREFS_MIGRATED_KEY = 'prefsMigratedFromSync';

/**
 * Managed preferences and their defaults (the former storage.sync flat keys).
 * The names double as the Drive payload keys and must match
 * prefsSyncLogic.PREF_SYNC_ALLOWLIST.
 */
export const PREF_DEFS = Object.freeze({
    theme: { def: 'geek' },
    listDensity: { def: 'cozy' },
    customTheme: { def: null },
    backgroundImageConfig: { def: null },          // null → backgroundImageManager applies its DEFAULT_CONFIG
    sectionOrder: { def: [] },
    uiLanguage: { def: 'auto' },
    readingListVisible: { def: true },
    newswireVisible: { def: true },
    aiGroupingVisible: { def: true },
    aiAutoNamingEnabled: { def: true },
    aiCleanupVisible: { def: true },
    pageReaderVisible: { def: true },
    hoverSummarizeEnabled: { def: true },
    readingListSummaryEnabled: { def: true },
    autoArchiveEnabled: { def: false },
    autoArchiveIdleHours: { def: 12 },
    routingEnabled: { def: true },
    aiAutoRoutingEnabled: { def: false },
    readingListSortOrder: { def: 'date-newest' },
});

const PREF_NAMES = Object.freeze(Object.keys(PREF_DEFS));

/** @param {string} name @returns {string} */
export function prefStorageKey(name) {
    return PREF_KEY_PREFIX + name;
}

/** @param {string} key @returns {boolean} true for any `pref_*` storage key */
export function isPrefStorageKey(key) {
    return typeof key === 'string' && key.startsWith(PREF_KEY_PREFIX);
}

/** @param {string} key @returns {string} */
export function prefNameFromKey(key) {
    return key.slice(PREF_KEY_PREFIX.length);
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isRecord = (r) => r && typeof r === 'object' && 'v' in r && Number.isFinite(r.t) && r.t >= 0;

/** Key-order-insensitive JSON for value comparison (merged values arrive key-sorted). */
function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}
/** @param {any} a @param {any} b @returns {boolean} */
export function prefValuesEqual(a, b) {
    return stableStringify(a) === stableStringify(b);
}

/**
 * @param {Object} deps
 * @param {{get:(area:string, keys:string[])=>Promise<Object>, set:(area:string, items:Object)=>Promise<void>, remove:(area:string, keys:string|string[])=>Promise<void>}} deps.storage
 * @param {() => number} [deps.now]
 */
export function createPrefsStore({ storage, now = () => Date.now() }) {
    let migration = null;

    function assertKnown(name) {
        if (!PREF_DEFS[name]) throw new Error(`prefsStore: unknown pref "${name}"`);
    }

    async function readRecords(names) {
        const keys = names.map(prefStorageKey);
        const res = await storage.get('local', keys);
        const out = {};
        for (const name of names) {
            const rec = res[prefStorageKey(name)];
            if (isRecord(rec)) out[name] = rec;
        }
        return out;
    }

    /**
     * One-time seed from storage.sync. Single-flight; idempotent via the flag.
     * Never rejects: a sync area that is missing or fails to read (possible on a
     * Chromium derivative) leaves local records / defaults fully usable; the
     * flag is then NOT written so a later context retries, but this context
     * will not retry on every getPref.
     */
    function ensureMigrated() {
        if (!migration) {
            migration = (async () => {
                const flags = (await storage.get('local', [PREFS_MIGRATED_KEY])) || {};
                if (flags[PREFS_MIGRATED_KEY]) return;
                let syncVals = null;
                try { syncVals = (await storage.get('sync', PREF_NAMES)) || {}; } catch { syncVals = null; }
                if (!syncVals) return; // could not read sync: keep going without a seed, retry later
                const batch = {};
                // Re-read right before writing: another context may have just set a
                // pref; a legacy value must never overwrite a fresh local record.
                const localRecs = await readRecords(PREF_NAMES);
                for (const name of PREF_NAMES) {
                    if (syncVals[name] === undefined) continue;   // default → no record (invariant)
                    if (localRecs[name]) continue;                 // never overwrite a real local record
                    batch[prefStorageKey(name)] = { v: clone(syncVals[name]), t: 0 };
                }
                if (Object.keys(batch).length) await storage.set('local', batch);
                await storage.set('local', { [PREFS_MIGRATED_KEY]: true });
            })().catch(() => { /* swallowed: prefs stay readable; flag not set */ });
        }
        return migration;
    }

    /** @param {string} name @returns {Promise<any>} value or the default; undefined for unknown names */
    async function getPref(name) {
        if (!PREF_DEFS[name]) return undefined;
        const recs = await readRecords([name]);
        return recs[name] ? clone(recs[name].v) : clone(PREF_DEFS[name].def);
    }

    /** @param {string[]} names @returns {Promise<Object>} name → value (records or defaults) */
    async function getPrefs(names) {
        const known = names.filter((n) => PREF_DEFS[n]);
        const recs = await readRecords(known);
        const out = {};
        for (const n of known) out[n] = recs[n] ? clone(recs[n].v) : clone(PREF_DEFS[n].def);
        return out;
    }

    /** @param {string} name @param {any} value */
    async function setPref(name, value) {
        assertKnown(name);
        const recs = await readRecords([name]);
        // Same value again: no write, no Lamport bump, no Drive flush, no UI churn.
        if (recs[name] && prefValuesEqual(recs[name].v, value)) return;
        const t = nextTimestamp(recs[name] ? recs[name].t : 0, now());
        await storage.set('local', { [prefStorageKey(name)]: { v: clone(value), t } });
    }

    /** @returns {Promise<{schema:number, entries:Object}>} existing records only */
    async function exportState() {
        const recs = await readRecords(PREF_NAMES);
        const entries = {};
        for (const [name, rec] of Object.entries(recs)) entries[name] = { v: clone(rec.v), t: rec.t };
        return { schema: PREFS_SYNC_SCHEMA, entries };
    }

    /**
     * Apply merged entries to local records, writing only what differs and
     * adopting the remote `t` verbatim (no bump → the resulting onChanged does
     * not look like a local edit).
     * @param {Object} entries name → { v, t }
     * @returns {Promise<string[]>} names written
     */
    async function importMerged(entries) {
        const allowed = filterToAllowlist(entries || {});
        const names = Object.keys(allowed).filter((n) => PREF_DEFS[n] && isRecord(allowed[n]));
        const current = await readRecords(names);
        const batch = {};
        const written = [];
        for (const name of names) {
            const next = allowed[name];
            const cur = current[name];
            if (cur && cur.t === next.t && prefValuesEqual(cur.v, next.v)) continue;
            // A local edit made while this cycle ran (after exportState) is newer
            // than anything the merge knew — never regress it; the next cycle pushes it.
            if (cur && cur.t > next.t) continue;
            batch[prefStorageKey(name)] = { v: clone(next.v), t: next.t };
            written.push(name);
        }
        if (written.length) await storage.set('local', batch);
        return written;
    }

    return { ensureMigrated, getPref, getPrefs, setPref, exportState, importMerged };
}

// --- Default instance (apiManager storage wrappers) -------------------------
let defaultStore = null;
function instance() {
    if (!defaultStore) {
        defaultStore = createPrefsStore({
            storage: {
                get: (area, keys) => getStorage(area, keys),
                set: (area, items) => setStorage(area, items),
                remove: (area, keys) => removeStorage(area, keys),
            },
        });
    }
    return defaultStore;
}

/** Call once per context before the first read (idempotent, single-flight). */
export const ensurePrefsMigrated = () => instance().ensureMigrated();
/** @param {string} name */
export const getPref = async (name) => { await ensurePrefsMigrated(); return instance().getPref(name); };
/** @param {string[]} names */
export const getPrefs = async (names) => { await ensurePrefsMigrated(); return instance().getPrefs(names); };
/** @param {string} name @param {any} value */
export const setPref = async (name, value) => { await ensurePrefsMigrated(); return instance().setPref(name, value); };
export const exportPrefsState = async () => { await ensurePrefsMigrated(); return instance().exportState(); };
/** @param {Object} entries */
export const importMergedPrefs = async (entries) => { await ensurePrefsMigrated(); return instance().importMerged(entries); };

/**
 * Drop-in for the former sync-area getStorage(spec): `spec` is either an
 * array of names or an object whose keys are names (its default values are
 * ignored — PREF_DEFS is the single source of defaults). Returns name → value.
 * @param {string[]|Object} spec
 * @returns {Promise<Object>}
 */
export const getPrefsLike = (spec) => getPrefs(Array.isArray(spec) ? spec : Object.keys(spec || {}));

/**
 * Drop-in for the former sync-area setStorage({ name: value, … }).
 * @param {Object} obj name → value
 */
export const setPrefsFromObject = async (obj) => {
    for (const [name, value] of Object.entries(obj || {})) await setPref(name, value);
};
