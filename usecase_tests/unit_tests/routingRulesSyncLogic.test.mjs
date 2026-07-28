// Unit tests for modules/routing/routingRulesSyncLogic.js (BASE-022 P4).
import {
    mergeRoutingRules,
    buildRoutingRulesPayload,
    canonicalizeRoutingRules,
    routingStatesEqual,
    isRoutingSchemaTooNew,
    ROUTING_SYNC_SCHEMA,
    ROUTING_TOMBSTONE_GC_MS,
} from '../../modules/routing/routingRulesSyncLogic.js';

// Epoch-ms scale matters: NOW must exceed the 60-day GC window, or an
// "expired" tombstone fixture (NOW - GC - 1) goes negative and gets floored
// to 0 by the union's Math.max — silently landing back inside the window.
const NOW = 1_750_000_000_000; // ≈ 2025-06 in real epoch ms

const rule = (id, over = {}) => ({
    id,
    enabled: true,
    matchType: 'domain',
    pattern: `${id}.com`,
    groupTitle: `G-${id}`,
    groupColor: null,
    order: 0,
    createdAt: 1,
    updatedAt: 100,
    ...over,
});

describe('mergeRoutingRules', () => {
    test('unions disjoint rule sets from both sides', () => {
        const merged = mergeRoutingRules(
            { rules: [rule('a')], tombstones: {} },
            { rules: [rule('b')], tombstones: {} },
            { now: NOW },
        );
        expect(merged.rules.map(r => r.id).sort()).toEqual(['a', 'b']);
        expect(merged.schemaVersion).toBe(ROUTING_SYNC_SCHEMA);
    });

    test('per-rule LWW: larger updatedAt wins', () => {
        const merged = mergeRoutingRules(
            { rules: [rule('a', { groupTitle: 'Old', updatedAt: 100 })], tombstones: {} },
            { rules: [rule('a', { groupTitle: 'New', updatedAt: 200 })], tombstones: {} },
            { now: NOW },
        );
        expect(merged.rules).toHaveLength(1);
        expect(merged.rules[0].groupTitle).toBe('New');
    });

    test('is commutative and idempotent for a fixed now', () => {
        const l = { rules: [rule('a', { updatedAt: 100 }), rule('b', { order: 2 })], tombstones: { x: NOW - 1 } };
        const r = { rules: [rule('a', { updatedAt: 100, groupTitle: 'Tie' }), rule('c')], tombstones: { b: 50 } };
        const ab = mergeRoutingRules(l, r, { now: NOW });
        const ba = mergeRoutingRules(r, l, { now: NOW });
        expect(canonicalizeRoutingRules(ab)).toBe(canonicalizeRoutingRules(ba));
        const again = mergeRoutingRules(ab, r, { now: NOW });
        expect(canonicalizeRoutingRules(again)).toBe(canonicalizeRoutingRules(ab));
    });

    test('tombstone hides a rule iff deletedAt >= updatedAt; a newer edit resurrects', () => {
        // NOW-relative stamps: ancient absolute values would be GC'd instantly.
        const del = NOW - 1_000;
        const hidden = mergeRoutingRules(
            { rules: [], tombstones: { a: del } },
            { rules: [rule('a', { updatedAt: del })], tombstones: {} },
            { now: NOW },
        );
        expect(hidden.rules).toHaveLength(0);

        const resurrected = mergeRoutingRules(
            { rules: [], tombstones: { a: del } },
            { rules: [rule('a', { updatedAt: del + 100 })], tombstones: {} },
            { now: NOW },
        );
        expect(resurrected.rules.map(r => r.id)).toEqual(['a']);
        expect(resurrected.tombstones.a).toBe(del); // tombstone kept until GC
    });

    test('tombstones union keeps the latest deletion and GCs after the grace window', () => {
        const merged = mergeRoutingRules(
            { rules: [], tombstones: { a: NOW - 100, old: NOW - ROUTING_TOMBSTONE_GC_MS - 1 } },
            { rules: [], tombstones: { a: NOW - 50 } },
            { now: NOW },
        );
        expect(merged.tombstones.a).toBe(NOW - 50);
        expect(merged.tombstones.old).toBeUndefined();
    });

    test('re-sorts merged rules by (order, createdAt)', () => {
        const merged = mergeRoutingRules(
            { rules: [rule('b', { order: 1 }), rule('c', { order: 1, createdAt: 0 })], tombstones: {} },
            { rules: [rule('a', { order: 0 })], tombstones: {} },
            { now: NOW },
        );
        expect(merged.rules.map(r => r.id)).toEqual(['a', 'c', 'b']);
    });
});

describe('payload / canonical form', () => {
    test('payload carries schema + bookkeeping; canonical form ignores bookkeeping', () => {
        const merged = mergeRoutingRules({ rules: [rule('a')], tombstones: {} }, {}, { now: NOW });
        const p1 = buildRoutingRulesPayload(merged, 'device-A', NOW);
        const p2 = buildRoutingRulesPayload(merged, 'device-B', NOW + 999);
        expect(p1.schemaVersion).toBe(ROUTING_SYNC_SCHEMA);
        expect(p1.deviceId).toBe('device-A');
        expect(routingStatesEqual(p1, p2)).toBe(true); // identity subset only
        expect(routingStatesEqual(p1, merged)).toBe(true);
    });

    test('no-op guard: equal states compare equal regardless of array order', () => {
        const a = { rules: [rule('a'), rule('b')], tombstones: { x: 1 } };
        const b = { rules: [rule('b'), rule('a')], tombstones: { x: 1 } };
        expect(routingStatesEqual(a, b)).toBe(true);
        expect(routingStatesEqual(a, { rules: [rule('a')], tombstones: { x: 1 } })).toBe(false);
    });
});

describe('isRoutingSchemaTooNew', () => {
    test('detects only strictly newer schemas', () => {
        expect(isRoutingSchemaTooNew({ schemaVersion: ROUTING_SYNC_SCHEMA + 1 })).toBe(true);
        expect(isRoutingSchemaTooNew({ schemaVersion: ROUTING_SYNC_SCHEMA })).toBe(false);
        expect(isRoutingSchemaTooNew({})).toBe(false);
        expect(isRoutingSchemaTooNew(null)).toBe(false);
    });
});
