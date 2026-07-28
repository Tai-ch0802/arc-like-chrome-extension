/**
 * @file routingRulesSyncLogic.js
 * PURE merge logic for syncing Tab Routing Rules across devices via Google
 * Drive appdata (BASE-022 P4). Mirrors rssSyncLogic's contract: no chrome, no
 * fetch, no Date.now / module state — time enters via `now`, so everything is
 * unit-testable in plain Node. The merge is COMMUTATIVE and IDEMPOTENT for a
 * fixed `now`; the background no-op write guard relies on that to settle in
 * <=2 cycles instead of an echo-suppression map.
 *
 * Model (SA §4.4):
 *   - ONE Drive file `routing-rules-sync.json`; per-rule LWW by `updatedAt`
 *     (ties broken deterministically so the merge stays commutative).
 *   - Deletions are soft tombstones {ruleId: deletedAtMs}; a tombstone hides a
 *     rule iff deletedAt >= that rule's updatedAt (a NEWER edit resurrects it
 *     on purpose), GC'd after 60 days.
 *   - Merged rules re-sorted by (order, createdAt).
 * ponytail: two devices reordering concurrently converge per-rule (LWW on each
 * moved rule's `order`), not to one guaranteed global order — rule edits are
 * rare, accepted (SA §4.4).
 *
 * @module modules/routing/routingRulesSyncLogic
 */

import { sortRules } from './routingLogic.js';

/** Current `routing-rules-sync.json` schema version this client writes/understands. */
export const ROUTING_SYNC_SCHEMA = 1;

/** Tombstone grace window: 60 days (same as workspace sync's GC horizon). A
 *  device offline past the window that still holds a deleted rule re-injects it
 *  once — documented, accepted: "delete it again". */
export const ROUTING_TOMBSTONE_GC_MS = 60 * 24 * 60 * 60 * 1000;

/** Normalize a possibly-partial state into the canonical full shape. */
function normalizeRoutingState(state) {
    const s = state || {};
    return {
        rules: Array.isArray(s.rules) ? s.rules : [],
        tombstones: (s.tombstones && typeof s.tombstones === 'object') ? s.tombstones : {},
    };
}

/** True iff the remote payload was written by a NEWER schema than this client. */
export function isRoutingSchemaTooNew(remote) {
    return !!remote
        && typeof remote.schemaVersion === 'number'
        && remote.schemaVersion > ROUTING_SYNC_SCHEMA;
}

/**
 * Pick the winning rule record for one id. Larger `updatedAt` wins; ties
 * resolve by a stable string compare so the merge is order-independent.
 */
function pickRule(a, b) {
    if (!a) return b;
    if (!b) return a;
    const au = a.updatedAt || 0;
    const bu = b.updatedAt || 0;
    if (au !== bu) return au > bu ? a : b;
    return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/**
 * Merge local and remote routing-rule state. COMMUTATIVE + IDEMPOTENT for a
 * fixed `now`.
 *
 * @param {{rules?:Array, tombstones?:Object}} local
 * @param {{rules?:Array, tombstones?:Object}} remote
 * @param {{now:number, tombstoneGcMs?:number}} opts
 * @returns {{schemaVersion:number, rules:Array, tombstones:Object<string,number>}}
 */
export function mergeRoutingRules(local, remote, opts) {
    const { now, tombstoneGcMs = ROUTING_TOMBSTONE_GC_MS } = opts || {};
    const l = normalizeRoutingState(local);
    const r = normalizeRoutingState(remote);

    // Union tombstones by id keeping the latest deletion, then GC by age.
    const tombstones = {};
    for (const [id, ts] of [...Object.entries(l.tombstones), ...Object.entries(r.tombstones)]) {
        tombstones[id] = Math.max(tombstones[id] || 0, ts || 0);
    }
    for (const id of Object.keys(tombstones)) {
        if (now - tombstones[id] > tombstoneGcMs) delete tombstones[id];
    }

    // Per-rule LWW union.
    const byId = new Map();
    for (const rule of [...l.rules, ...r.rules]) {
        if (!rule || !rule.id) continue;
        byId.set(rule.id, pickRule(byId.get(rule.id) || null, rule));
    }

    // A tombstone hides a rule iff it is at least as new as the rule's last
    // edit; a newer edit resurrects intentionally.
    const rules = [];
    for (const rule of byId.values()) {
        const deletedAt = tombstones[rule.id];
        if (deletedAt !== undefined && deletedAt >= (rule.updatedAt || 0)) continue;
        rules.push(rule);
    }

    return { schemaVersion: ROUTING_SYNC_SCHEMA, rules: sortRules(rules), tombstones };
}

/**
 * The Drive file payload for a merged state. Top-level updatedAt/deviceId are
 * bookkeeping only — the no-op guard compares the identity subset via
 * canonicalizeRoutingRules, which excludes them.
 */
export function buildRoutingRulesPayload(merged, deviceId, now) {
    const s = normalizeRoutingState(merged);
    return {
        schemaVersion: ROUTING_SYNC_SCHEMA,
        updatedAt: now,
        deviceId,
        rules: s.rules,
        tombstones: s.tombstones,
    };
}

/**
 * Canonical, order-independent string form of the IDENTITY subset (rules +
 * tombstones; top-level updatedAt/deviceId excluded) — the no-op write guard.
 */
export function canonicalizeRoutingRules(state) {
    const s = normalizeRoutingState(state);
    const rules = s.rules
        .map((x) => ({
            id: x.id,
            enabled: x.enabled !== false,
            matchType: x.matchType,
            pattern: x.pattern,
            groupTitle: x.groupTitle,
            groupColor: x.groupColor || null,
            order: x.order || 0,
            createdAt: x.createdAt || 0,
            updatedAt: x.updatedAt || 0,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const tombs = Object.keys(s.tombstones).sort().map((k) => [k, s.tombstones[k]]);
    return JSON.stringify({ rules, tombs });
}

/** True iff two states are equivalent (ignoring order / bookkeeping fields). */
export function routingStatesEqual(a, b) {
    return canonicalizeRoutingRules(a) === canonicalizeRoutingRules(b);
}
