// --- Routing Rules Store ---
// CRUD over the chrome.storage.local `routingRules` key (single source of
// truth, BASE-022 SA §4.1). Used by the options page, the sidepanel
// rule-creation flow, and the background engine (read side). Tombstones are
// recorded from day one so the P4 Drive merge cannot resurrect deleted rules.

import * as api from '../apiManager.js';
import { ROUTING_RULES_KEY, ROUTING_RULES_SCHEMA, MAX_RULES, sortRules } from './routingLogic.js';

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
 * @returns {Promise<Object|null>} the created rule, or null when the cap is hit
 */
export async function addRule({ matchType, pattern, groupTitle, groupColor = null }) {
    const state = await getRoutingState();
    if (state.rules.length >= MAX_RULES) return null;
    const now = Date.now();
    const rule = {
        id: crypto.randomUUID(),
        enabled: true,
        matchType,
        pattern: String(pattern || '').trim().slice(0, 256),
        groupTitle: String(groupTitle || '').trim().slice(0, 64),
        groupColor: groupColor || null,
        order: state.rules.length ? Math.max(...state.rules.map(r => r.order)) + 1 : 0,
        createdAt: now,
        updatedAt: now,
    };
    if (!rule.pattern || !rule.groupTitle) return null;
    state.rules.push(rule);
    await saveRoutingState(state);
    return rule;
}

/** @returns {Promise<boolean>} false when the rule does not exist */
export async function updateRule(id, patch) {
    const state = await getRoutingState();
    const rule = state.rules.find(r => r.id === id);
    if (!rule) return false;
    const allowed = ['enabled', 'matchType', 'pattern', 'groupTitle', 'groupColor'];
    for (const key of allowed) {
        if (key in patch) rule[key] = patch[key];
    }
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
