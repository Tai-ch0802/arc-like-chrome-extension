/**
 * @file prefsSyncLogic.js
 * PURE merge core for syncing user preferences across devices via the Google
 * Drive file `settings-sync.json`. No chrome, no fetch, no Date, no module
 * state — every input arrives as an argument so it is unit-testable in Node.
 *
 * Data shape: `{ schema: 1, entries: { [name]: { v: any, t: number } } }`.
 * Merge is per-key Last-Writer-Wins on `t`; a key missing on one side makes
 * no claim (the other side's record is taken as-is). Equal `t` is broken
 * deterministically by `JSON.stringify(v)` so the merge is commutative,
 * associative and idempotent.
 *
 * @module modules/prefs/prefsSyncLogic
 */

/** Current `settings-sync.json` schema version this client writes/understands. */
export const PREFS_SYNC_SCHEMA = 1;

/** Preference names that may be synced. Anything else is dropped. */
export const PREF_SYNC_ALLOWLIST = Object.freeze([
    'theme',
    'listDensity',
    'customTheme',
    'backgroundImageConfig',
    'sectionOrder',
    'uiLanguage',
    'readingListVisible',
    'newswireVisible',
    'aiGroupingVisible',
    'aiAutoNamingEnabled',
    'aiCleanupVisible',
    'pageReaderVisible',
    'hoverSummarizeEnabled',
    'readingListSummaryEnabled',
    'autoArchiveEnabled',
    'autoArchiveIdleHours',
    'routingEnabled',
    'aiAutoRoutingEnabled',
    'readingListSortOrder',
]);

const ALLOWED = new Set(PREF_SYNC_ALLOWLIST);

const isPlainObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Stable string form of a value used only for the equal-`t` tie-break. */
function tieKey(v) {
    const s = JSON.stringify(sortKeys(v));
    return s === undefined ? '' : s;
}

/** Recursively sort object keys so equal values stringify identically. */
function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (isPlainObject(v)) {
        const out = {};
        for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
        return out;
    }
    return v;
}

/** Deep clone (object keys sorted) so results never alias inputs and are order-stable. */
function cloneValue(v) {
    return v === undefined ? v : JSON.parse(JSON.stringify(sortKeys(v)));
}

/**
 * Normalize a (possibly untrusted) state: keep every name (unknown keys pass
 * through for forward compatibility — use `filterToAllowlist` when applying to
 * local storage) whose record is an object with a finite `t >= 0` and a
 * defined `v`; clones values, sort keys ascending, default the
 * schema. Never mutates the input.
 *
 * @param {*} state
 * @returns {{schema: number, entries: Object<string, {v: *, t: number}>}}
 */
export function canonicalizePrefs(state) {
    const src = isPlainObject(state) ? state : {};
    const schema = typeof src.schema === 'number' && Number.isFinite(src.schema) ? src.schema : PREFS_SYNC_SCHEMA;
    const rawEntries = isPlainObject(src.entries) ? src.entries : {};
    const entries = {};
    for (const name of Object.keys(rawEntries).sort()) {
        const r = rawEntries[name];
        if (!isPlainObject(r)) continue;
        if (typeof r.t !== 'number' || !Number.isFinite(r.t) || r.t < 0) continue;
        if (r.v === undefined) continue;
        entries[name] = { v: cloneValue(r.v), t: r.t };
    }
    return { schema, entries };
}

/**
 * Per-key Last-Writer-Wins merge (unknown keys preserved). Commutative, associative, idempotent.
 *
 * @param {*} local
 * @param {*} remote
 * @returns {{schema: number, entries: Object<string, {v: *, t: number}>}}
 */
export function mergePrefsState(local, remote) {
    const l = canonicalizePrefs(local).entries;
    const r = canonicalizePrefs(remote).entries;
    const merged = {};
    for (const name of new Set([...Object.keys(l), ...Object.keys(r)])) {
        const a = l[name];
        const b = r[name];
        if (!a) merged[name] = b;
        else if (!b) merged[name] = a;
        else if (a.t !== b.t) merged[name] = a.t > b.t ? a : b;
        else merged[name] = tieKey(a.v) >= tieKey(b.v) ? a : b;
    }
    return canonicalizePrefs({ schema: PREFS_SYNC_SCHEMA, entries: merged });
}

/**
 * Keep only allowlisted names. Callers use this when APPLYING merged entries to
 * local storage; the merge itself preserves unknown keys. Pure, non-mutating.
 *
 * @param {*} entries
 * @returns {Object<string, {v: *, t: number}>}
 */
export function filterToAllowlist(entries) {
    const out = {};
    if (!isPlainObject(entries)) return out;
    for (const name of Object.keys(entries)) {
        if (ALLOWED.has(name)) out[name] = entries[name];
    }
    return out;
}

/**
 * Deep equality of two states after canonicalization (key order insensitive).
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function prefsStateEqual(a, b) {
    return JSON.stringify(canonicalizePrefs(a)) === JSON.stringify(canonicalizePrefs(b));
}

/**
 * True when the remote file was written by a newer client schema.
 *
 * @param {*} remote
 * @returns {boolean}
 */
export function isPrefsSchemaTooNew(remote) {
    return isPlainObject(remote) && typeof remote.schema === 'number' && remote.schema > PREFS_SYNC_SCHEMA;
}
