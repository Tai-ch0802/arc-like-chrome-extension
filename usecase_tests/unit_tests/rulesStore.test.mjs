// Unit tests for modules/routing/rulesStore.js (BASE-022).
// chrome.storage.local is stubbed with an in-memory map (callback-style, same
// shape apiManager wraps); getMessage already returns '' via jest.setup stub.
import { MAX_RULES } from '../../modules/routing/routingLogic.js';
// Static import is safe: rulesStore only touches chrome.* inside functions,
// and the beforeEach below installs the stub before any call.
import * as rulesStore from '../../modules/routing/rulesStore.js';

let store;

beforeEach(() => {
    store = {};
    globalThis.chrome = {
        ...globalThis.chrome,
        runtime: { ...(globalThis.chrome?.runtime || {}), lastError: undefined },
        storage: {
            ...(globalThis.chrome?.storage || {}),
            local: {
                get: (keys, cb) => {
                    const out = {};
                    for (const k of Object.keys(keys)) out[k] = k in store ? store[k] : keys[k];
                    cb(out);
                },
                set: (items, cb) => {
                    Object.assign(store, items);
                    cb();
                },
            },
            onChanged: { addListener: () => {} },
        },
    };
});

const input = (over = {}) => ({
    matchType: 'domain',
    pattern: 'example.com',
    groupTitle: 'Media',
    groupColor: 'red',
    ...over,
});

describe('addRule / getRoutingState', () => {
    test('creates a rule with id, order, timestamps and persists it', async () => {
        const rule = await rulesStore.addRule(input());
        expect(rule.id).toBeTruthy();
        expect(rule.enabled).toBe(true);
        expect(rule.order).toBe(0);

        const state = await rulesStore.getRoutingState();
        expect(state.rules).toHaveLength(1);
        expect(state.rules[0].id).toBe(rule.id);
        expect(state.schemaVersion).toBe(1);
    });
    test('trims input and rejects empty pattern/title', async () => {
        const r = await rulesStore.addRule(input({ pattern: '  example.com  ', groupTitle: ' G ' }));
        expect(r.pattern).toBe('example.com');
        expect(r.groupTitle).toBe('G');
        expect(await rulesStore.addRule(input({ pattern: '   ' }))).toBeNull();
        expect(await rulesStore.addRule(input({ groupTitle: '' }))).toBeNull();
    });
    test(`caps at ${MAX_RULES} rules (FR-1.02)`, async () => {
        for (let i = 0; i < MAX_RULES; i++) {
            expect(await rulesStore.addRule(input({ pattern: `site-${i}.com` }))).not.toBeNull();
        }
        expect(await rulesStore.addRule(input({ pattern: 'overflow.com' }))).toBeNull();
        const state = await rulesStore.getRoutingState();
        expect(state.rules).toHaveLength(MAX_RULES);
    });
    test('orders new rules after existing ones', async () => {
        const a = await rulesStore.addRule(input({ pattern: 'a.com' }));
        const b = await rulesStore.addRule(input({ pattern: 'b.com' }));
        expect(b.order).toBeGreaterThan(a.order);
    });
});

describe('updateRule / setRuleEnabled', () => {
    test('patches allowed fields and bumps updatedAt', async () => {
        const rule = await rulesStore.addRule(input());
        const before = rule.updatedAt;
        await new Promise(r => setTimeout(r, 5));
        expect(await rulesStore.updateRule(rule.id, { groupTitle: 'News', order: 99 })).toBe(true);
        const state = await rulesStore.getRoutingState();
        expect(state.rules[0].groupTitle).toBe('News');
        expect(state.rules[0].order).toBe(0); // order not patchable via updateRule
        expect(state.rules[0].updatedAt).toBeGreaterThan(before);
    });
    test('returns false for unknown id', async () => {
        expect(await rulesStore.updateRule('nope', { groupTitle: 'X' })).toBe(false);
    });
    test('setRuleEnabled toggles participation flag', async () => {
        const rule = await rulesStore.addRule(input());
        await rulesStore.setRuleEnabled(rule.id, false);
        const state = await rulesStore.getRoutingState();
        expect(state.rules[0].enabled).toBe(false);
    });
});

describe('deleteRule', () => {
    test('removes the rule and records a tombstone (P4 merge safety)', async () => {
        const rule = await rulesStore.addRule(input());
        expect(await rulesStore.deleteRule(rule.id)).toBe(true);
        const state = await rulesStore.getRoutingState();
        expect(state.rules).toHaveLength(0);
        expect(state.tombstones[rule.id]).toBeGreaterThan(0);
    });
});

describe('reorderRules', () => {
    test('rewrites order to the given sequence; getRoutingState returns sorted', async () => {
        const a = await rulesStore.addRule(input({ pattern: 'a.com' }));
        const b = await rulesStore.addRule(input({ pattern: 'b.com' }));
        const c = await rulesStore.addRule(input({ pattern: 'c.com' }));
        await rulesStore.reorderRules([c.id, a.id, b.id]);
        const state = await rulesStore.getRoutingState();
        expect(state.rules.map(r => r.pattern)).toEqual(['c.com', 'a.com', 'b.com']);
    });
});

describe('claimUrls', () => {
    test('sends one routing:claim message and awaits the ack', async () => {
        const sent = [];
        globalThis.chrome.runtime.sendMessage = (msg) => {
            sent.push(msg);
            return Promise.resolve({ ok: true });
        };
        await rulesStore.claimUrls(['https://a.b/x', '', null]);
        expect(sent).toEqual([{ action: 'routing:claim', urls: ['https://a.b/x'] }]);
    });
    test('fail-open: a rejected message never throws (FR-2.07)', async () => {
        globalThis.chrome.runtime.sendMessage = () => Promise.reject(new Error('no receiver'));
        await expect(rulesStore.claimUrls(['https://a.b/x'])).resolves.toBeUndefined();
    });
    test('skips the message entirely for an empty list', async () => {
        let called = false;
        globalThis.chrome.runtime.sendMessage = () => { called = true; return Promise.resolve(); };
        await rulesStore.claimUrls([]);
        expect(called).toBe(false);
    });
});
