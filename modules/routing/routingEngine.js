// --- Routing Engine (background service worker only) ---
// Listens for each tab's FIRST real (http/https) navigation and applies the
// user's routing rules (BASE-022 SA §5.2). SW-specific module: uses chrome.*
// directly, same as workspaceLifecycle (RULE_002 invariant 1 SW exception).
//
// Concurrency model: ALL ephemeral state lives in one chrome.storage.session
// key, written only by this module, and every read-modify-write goes through
// a promise chain (`mutate`) — so interleaved tab events cannot lose updates,
// and the state survives SW idle termination (cleared on browser restart,
// which is exactly the wanted semantics).

import {
    isRealHttpUrl,
    isStartupRestored,
    matchRule,
    consumeClaim,
    addClaims,
    pruneClaims,
    STARTUP_WINDOW_MS,
    ROUTING_RULES_KEY,
} from './routingLogic.js';
import { getRoutingState } from './rulesStore.js';

const SESSION_KEY = 'routingSessionState';
const ROUTING_ENABLED_KEY = 'routingEnabled';

let mutateChain = Promise.resolve();
let rulesCache = null;    // sorted rule list; invalidated via storage.onChanged
let enabledCache = null;  // boolean | null when not yet loaded

function defaultState() {
    return { judged: {}, claims: {}, claimedTabs: {}, candidates: {}, startupUntil: 0 };
}

async function loadState() {
    const res = await chrome.storage.session.get(SESSION_KEY);
    const st = res[SESSION_KEY];
    return (st && typeof st === 'object') ? { ...defaultState(), ...st } : defaultState();
}

/**
 * Serialize a state mutation. The returned promise resolves AFTER the state
 * is persisted — routing:claim relies on this for its ordering guarantee.
 */
function mutate(fn) {
    const run = mutateChain
        .then(async () => {
            const st = await loadState();
            await fn(st);
            await chrome.storage.session.set({ [SESSION_KEY]: st });
        })
        .catch(err => console.warn('[routing] mutation failed', err));
    mutateChain = run;
    return run;
}

async function ensureRules() {
    if (rulesCache) return rulesCache;
    const state = await getRoutingState();
    rulesCache = state.rules;
    return rulesCache;
}

async function ensureEnabled() {
    if (enabledCache === null) {
        const res = await chrome.storage.sync.get({ [ROUTING_ENABLED_KEY]: true });
        enabledCache = res[ROUTING_ENABLED_KEY] !== false;
    }
    return enabledCache;
}

/** Add the tab to the window's group with the rule's title, creating it if needed. */
async function applyRule(tab, rule) {
    const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
    const existing = groups.find(g => g.title === rule.groupTitle);
    if (existing) {
        await chrome.tabs.group({ tabIds: [tab.id], groupId: existing.id });
        return;
    }
    const groupId = await chrome.tabs.group({
        tabIds: [tab.id],
        createProperties: { windowId: tab.windowId },
    });
    const update = { title: rule.groupTitle };
    if (rule.groupColor) update.color = rule.groupColor;
    await chrome.tabGroups.update(groupId, update);
}

/** The single judgment per tab (FR-2.04): claim → exemptions → rules. */
function handleFirstNavigation(tabId, url) {
    mutate(async (st) => {
        if (st.judged[tabId]) return;
        st.judged[tabId] = true;

        const candidate = st.candidates[tabId];
        delete st.candidates[tabId];
        const wasClaimed = st.claimedTabs[tabId];
        delete st.claimedTabs[tabId];

        const now = Date.now();
        pruneClaims(st.claims, now);
        if (wasClaimed) return;                                  // FR-2.07 (bound at create)
        if (consumeClaim(st.claims, url, now)) return;           // FR-2.07 (fallback by URL)
        if (!candidate) return;             // tab not born under engine watch — never route
        if (!(await ensureEnabled())) return;                    // FR-2.06
        if (isStartupRestored(candidate, st.startupUntil)) return; // SA §5.3

        let tab;
        try {
            tab = await chrome.tabs.get(tabId);
        } catch {
            return; // closed mid-flight
        }
        if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE || tab.pinned) return; // FR-2.02/2.03

        const rule = matchRule(url, await ensureRules());        // FR-1.03 first match wins
        if (!rule) return;
        await applyRule(tab, rule);                              // FR-2.01
    });
}

/**
 * Register all listeners. MUST be called synchronously at SW top level (MV3).
 */
export function initRoutingEngine() {
    chrome.tabs.onCreated.addListener((tab) => {
        const initialUrl = tab.pendingUrl || tab.url || '';
        mutate(async (st) => {
            const now = Date.now();
            pruneClaims(st.claims, now);
            st.candidates[tab.id] = {
                hadUrlAtCreate: isRealHttpUrl(initialUrl),
                hasOpener: !!tab.openerTabId,
                createdAt: now,
            };
            // Bind claims at creation via pendingUrl: redirect-proof, since the
            // committed URL after a server redirect may differ from the claimed one.
            if (isRealHttpUrl(initialUrl) && consumeClaim(st.claims, initialUrl, now)) {
                st.claimedTabs[tab.id] = true;
            }
        });
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        // Cheap synchronous pre-filter: only the first http(s) commit enters the chain.
        if (!changeInfo.url || !isRealHttpUrl(changeInfo.url)) return;
        handleFirstNavigation(tabId, changeInfo.url);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
        mutate(async (st) => {
            delete st.judged[tabId];
            delete st.candidates[tabId];
            delete st.claimedTabs[tabId];
        });
    });

    chrome.runtime.onStartup.addListener(() => {
        mutate(async (st) => {
            st.startupUntil = Date.now() + STARTUP_WINDOW_MS;
        });
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.action !== 'routing:claim') return; // other listeners handle
        mutate(async (st) => {
            addClaims(st.claims, message.urls, Date.now());
        }).then(() => sendResponse({ ok: true }));
        return true; // async response
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[ROUTING_RULES_KEY]) rulesCache = null;
        if (area === 'sync' && changes[ROUTING_ENABLED_KEY]) enabledCache = null;
    });
}
