/**
 * @file newswireSyncLogic.js
 * PURE merge logic for syncing newswire settings across devices via Google Drive
 * appdata. Every function here is a pure function of its arguments — NO chrome,
 * NO fetch, NO Date.now / Math.random, NO module state (mirrors rssSyncLogic).
 *
 * Sync model (SA §4.3 — simpler than RSS: no dynamic collection, no tombstones):
 *   - newswire settings live in ONE Drive file `newswire-sync.json`:
 *     { schemaVersion, config:{sources, rules, prefs}, keys?, updatedAt }.
 *   - Merge is PER-GROUP last-writer-wins by each group's own `updatedAt`:
 *     sources.{tree,fj,alpaca,jin10,tg}, rules, and prefs each merge independently.
 *     Sources are a FIXED set (5) so there is no add/remove → no tombstones.
 *     NOTE the granularity: `rules` is ONE group — editing P0 on device A while
 *     device B edits P1 does NOT field-merge; the later `updatedAt` wins the
 *     whole rules block. Same for `keys` (see mergeKeys). Acceptable because
 *     rule edits are rare and one-device-at-a-time in practice; revisit with
 *     per-field updatedAt if concurrent multi-device editing shows up.
 *   - API keys are SENSITIVE (aiProviderSettings convention: local-only working
 *     copy). They enter the Drive payload ONLY when the merged prefs.syncKeys is
 *     true; turning the opt-in off pushes a keys-less payload that SCRUBS the
 *     remote copy (FR-20). keys merge as one blob by keys.updatedAt.
 *   - Convergence relies on the merge being COMMUTATIVE and IDEMPOTENT for a
 *     fixed input; the background no-op-write guard (canonicalizeNewswire)
 *     depends on it to settle in <=2 cycles.
 *
 * @module modules/newswire/newswireSyncLogic
 */

export const NEWSWIRE_SYNC_SCHEMA = 1;
export const NEWSWIRE_SOURCE_IDS = ['tree', 'fj', 'alpaca', 'jin10', 'tg'];

/**
 * Keys that must never be copied from remote JSON onto a fresh object. A literal
 * `"__proto__"` key survives JSON.parse as an OWN property, and assigning it with
 * bracket notation triggers the Object.prototype.__proto__ setter — which
 * re-points THAT object's prototype (it does not poison Object.prototype, but a
 * lookup miss on the object would then resolve against attacker-supplied data).
 * The remote payload comes from Drive appdata, so treat it as untrusted input.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Pick the newer of two grouped records by `updatedAt` (last edit wins). Ties
 * resolve deterministically & order-independently (stable string compare) so the
 * merge is commutative even when two devices' clocks produce equal timestamps.
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @returns {object|null}
 */
export function pickNewer(a, b) {
    if (a == null) return b == null ? null : b;
    if (b == null) return a;
    const au = a.updatedAt || 0;
    const bu = b.updatedAt || 0;
    if (au !== bu) return au > bu ? a : b;
    return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/**
 * Per-group LWW merge of the config object (sources/rules/prefs). Unknown source
 * ids (a newer client / future source another device has) are preserved.
 * @param {object} localCfg
 * @param {object} remoteCfg
 * @returns {{schemaVersion:number, sources:object, rules:object, prefs:object}}
 */
export function mergeNewswireConfig(localCfg, remoteCfg) {
    const l = localCfg || {};
    const r = remoteCfg || {};
    const lSources = l.sources || {};
    const rSources = r.sources || {};
    const sources = {};
    for (const id of new Set([...NEWSWIRE_SOURCE_IDS, ...Object.keys(lSources), ...Object.keys(rSources)])) {
        if (UNSAFE_KEYS.has(id)) continue; // 不可信遠端 JSON 的原型改寫防護
        const merged = pickNewer(lSources[id], rSources[id]);
        if (merged) sources[id] = merged;
    }
    return {
        schemaVersion: NEWSWIRE_SYNC_SCHEMA,
        sources,
        rules: pickNewer(l.rules, r.rules) || { p0: [], p1: [], mute: [], updatedAt: 0 },
        prefs: pickNewer(l.prefs, r.prefs) || { notificationsEnabled: true, syncKeys: false, updatedAt: 0 },
    };
}

/**
 * Merge API keys as a single blob by `updatedAt` (LWW).
 * // ponytail: whole-blob LWW, not per-source. If two devices each fill a
 * // DIFFERENT source's key at the same time, one blob wins and the other's
 * // entry is lost. In practice keys are entered on one device then opted-in;
 * // add per-source updatedAt only if concurrent multi-device key entry appears.
 * @param {object} localKeys
 * @param {object} remoteKeys
 * @returns {object}
 */
export function mergeKeys(localKeys, remoteKeys) {
    return pickNewer(localKeys, remoteKeys) || {};
}

/**
 * Merge local and remote newswire state into the converged result. Returns the
 * config to persist locally, plus keys split into what to persist locally vs
 * what to write to Drive (undefined remoteKeys = scrub remote keys).
 *
 * @param {{config?:object, keys?:object}} local
 * @param {{config?:object, keys?:object}} remote
 * @returns {{schemaVersion:number, config:object, localKeys:object, remoteKeys:(object|undefined)}}
 */
export function mergeNewswireState(local, remote) {
    const config = mergeNewswireConfig(local?.config, remote?.config);
    const syncKeys = config.prefs?.syncKeys === true;
    let localKeys;
    let remoteKeys;
    if (syncKeys) {
        // Opt-in ON: keys roam. Both the local copy and the Drive payload get the
        // LWW-merged keys.
        const merged = mergeKeys(local?.keys, remote?.keys);
        localKeys = merged;
        remoteKeys = merged;
    } else {
        // Opt-in OFF: local working copy is untouched (never lose the user's own
        // keys); the Drive payload carries NO keys → scrubs any remote copy.
        localKeys = local?.keys || {};
        remoteKeys = undefined;
    }
    return { schemaVersion: NEWSWIRE_SYNC_SCHEMA, config, localKeys, remoteKeys };
}

/**
 * Build the Drive payload from a merged result. Keys are included only when the
 * opt-in kept them (remoteKeys defined).
 * @param {{config:object, remoteKeys:(object|undefined)}} merged
 * @param {number} now
 * @returns {object}
 */
export function buildNewswirePayload(merged, now) {
    const payload = {
        schemaVersion: NEWSWIRE_SYNC_SCHEMA,
        config: merged.config,
        updatedAt: now || 0,
    };
    if (merged.remoteKeys !== undefined) payload.keys = merged.remoteKeys;
    return payload;
}

function sortKeysDeep(v) {
    if (Array.isArray(v)) return v.map(sortKeysDeep); // 陣列保序:關鍵字順序是使用者資料
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v).sort()) {
            if (UNSAFE_KEYS.has(k)) continue; // 同上:canonical 每次 sync 都會跑
            out[k] = sortKeysDeep(v[k]);
        }
        return out;
    }
    return v;
}

/**
 * Canonical, order-independent string form used by the no-op write guard. Object
 * keys are sorted; arrays keep their order (they are user-entered data). The
 * top-level payload `updatedAt` is intentionally NOT part of the identity — it
 * changes every cycle and would defeat the guard — so callers canonicalize the
 * {config, keys} subset.
 * @param {object} obj
 * @returns {string}
 */
export function canonicalizeNewswire(obj) {
    return JSON.stringify(sortKeysDeep(obj ?? null));
}
