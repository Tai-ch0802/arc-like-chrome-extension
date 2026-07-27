// --- Routing Rules Store ---
// CRUD over the chrome.storage.local `routingRules` key (single source of
// truth, BASE-022 SA §4.1). Used by the options page, the sidepanel
// rule-creation flow, and the background engine (read side). Tombstones are
// recorded from day one so the P4 Drive merge cannot resurrect deleted rules.

import * as api from '../apiManager.js';
import { ROUTING_RULES_KEY, ROUTING_RULES_SCHEMA, MAX_RULES, sortRules, sanitizeRuleInput } from './routingLogic.js';

export { ROUTING_RULES_KEY };

const EMPTY_STATE = () => ({
    schemaVersion: ROUTING_RULES_SCHEMA,
    updatedAt: 0,
    rules: [],
    tombstones: {},
});

/** @returns {Promise<{schemaVersion:number, updatedAt:number, rules:Array, tombstones:Object}>} */
export async function getRoutingState() {
    const result = await api.getStorage('local', { [ROUTING_RULES_KEY]: null });
    const state = result[ROUTING_RULES_KEY];
    if (!state || !Array.isArray(state.rules)) return EMPTY_STATE();
    return {
        schemaVersion: state.schemaVersion || ROUTING_RULES_SCHEMA,
        updatedAt: state.updatedAt || 0,
        rules: sortRules(state.rules),
        tombstones: state.tombstones || {},
    };
}

async function saveRoutingState(state) {
    state.updatedAt = Date.now();
    await api.setStorageStrict('local', { [ROUTING_RULES_KEY]: state });
    return state;
}

/**
 * @param {{matchType:'domain'|'contains', pattern:string, groupTitle:string, groupColor?:string|null}} input
 * @returns {Promise<Object|null>} the created rule; null when the cap is hit or the input is invalid
 */
export async function addRule({ matchType, pattern, groupTitle, groupColor = null }) {
    const state = await getRoutingState();
    if (state.rules.length >= MAX_RULES) return null;
    const clean = sanitizeRuleInput({ matchType, pattern, groupTitle, groupColor });
    if (!clean || !clean.matchType || !clean.pattern || !clean.groupTitle) return null;
    const now = Date.now();
    const rule = {
        id: crypto.randomUUID(),
        enabled: true,
        ...clean,
        order: state.rules.length ? Math.max(...state.rules.map(r => r.order)) + 1 : 0,
        createdAt: now,
        updatedAt: now,
    };
    state.rules.push(rule);
    await saveRoutingState(state);
    return rule;
}

/**
 * Patch a rule. The patch goes through the same sanitizer as addRule, so the
 * stored RoutingRule invariants (matchType enum, 256/64 caps, color enum)
 * hold no matter which caller writes.
 * @returns {Promise<boolean>} false when the rule does not exist or any provided field is invalid
 */
export async function updateRule(id, patch) {
    const state = await getRoutingState();
    const rule = state.rules.find(r => r.id === id);
    if (!rule) return false;
    const clean = sanitizeRuleInput(patch);
    if (clean === null) return false;
    Object.assign(rule, clean);
    rule.updatedAt = Date.now();
    await saveRoutingState(state);
    return true;
}

export async function deleteRule(id) {
    const state = await getRoutingState();
    const idx = state.rules.findIndex(r => r.id === id);
    if (idx === -1) return false;
    state.rules.splice(idx, 1);
    state.tombstones[id] = Date.now();
    await saveRoutingState(state);
    return true;
}

/** Rewrites `order` to match the given id sequence; unknown ids are ignored. */
export async function reorderRules(orderedIds) {
    const state = await getRoutingState();
    const byId = new Map(state.rules.map(r => [r.id, r]));
    const now = Date.now();
    let order = 0;
    for (const id of orderedIds) {
        const rule = byId.get(id);
        if (!rule) continue;
        if (rule.order !== order) {
            rule.order = order;
            rule.updatedAt = now;
        }
        order += 1;
    }
    await saveRoutingState(state);
    return true;
}

export function setRuleEnabled(id, enabled) {
    return updateRule(id, { enabled });
}

/**
 * Register routing-claim exemptions for URLs this extension is about to open
 * with a designated group (FR-2.07). MUST be awaited BEFORE tabs.create /
 * windows.create: the ack guarantees the claim is registered before the
 * routing engine can observe the tab. Fail-open by design — a claim failure
 * must never block opening the tab.
 * @param {string[]} urls
 */
export async function claimUrls(urls) {
    const list = (urls || []).filter(u => typeof u === 'string' && u);
    if (list.length === 0) return;
    try {
        await api.sendRuntimeMessage({ action: 'routing:claim', urls: list });
    } catch (err) {
        console.warn('[routing] claim failed, proceeding unclaimed', err);
    }
}
