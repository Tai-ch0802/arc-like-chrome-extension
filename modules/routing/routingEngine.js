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
    normalizeHost,
    consumeClaim,
    addClaims,
    pruneClaims,
    decideAiRouting,
    STARTUP_WINDOW_MS,
    AI_UNDO_COOLDOWN_MS,
    VALID_GROUP_COLORS,
    ROUTING_RULES_KEY,
} from './routingLogic.js';
import { getRoutingState } from './rulesStore.js';
import { generateGroupName } from '../aiManager.js';

const SESSION_KEY = 'routingSessionState';
const ROUTING_ENABLED_KEY = 'routingEnabled';
const AI_ROUTING_KEY = 'aiAutoRoutingEnabled';

let mutateChain = Promise.resolve();
let rulesCache = null;      // sorted rule list; invalidated via storage.onChanged
let enabledCache = null;    // boolean | null when not yet loaded
let aiEnabledCache = null;  // boolean | null when not yet loaded (opt-in, default false)

function defaultState() {
    return {
        judged: {}, claims: {}, claimedTabs: {}, candidates: {}, startupUntil: 0,
        lastNav: null, aiGroups: {}, cooldown: {},
    };
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

async function ensureAiEnabled() {
    if (aiEnabledCache === null) {
        const res = await chrome.storage.sync.get({ [AI_ROUTING_KEY]: false });
        aiEnabledCache = res[AI_ROUTING_KEY] === true; // opt-in (FR-3.06)
    }
    return aiEnabledCache;
}

/**
 * Fire-and-forget AI naming for a freshly created AI group (FR-3.04/3.05d).
 * Runs OUTSIDE the mutate chain: cloud providers can take seconds and must
 * not block tab-event processing. Never overwrites a manual rename — the
 * write happens only when the title is still the domain placeholder.
 */
async function scheduleAiNaming(groupId, domain, tabs) {
    try {
        const name = await generateGroupName(
            tabs.map(t => ({ title: t.title || '', url: t.url || '' }))
        );
        if (!name) return; // AI unavailable → keep the domain placeholder
        const g = await chrome.tabGroups.get(groupId).catch(() => null);
        if (!g || g.title !== domain) return;
        await chrome.tabGroups.update(groupId, { title: name });
        await mutate(async (st) => {
            const entry = st.aiGroups[g.windowId] && st.aiGroups[g.windowId][domain];
            if (entry && entry.groupId === groupId) entry.aiNamed = true;
        });
    } catch (err) {
        console.warn('[routing] ai naming skipped', err);
    }
}

/** SW → sidepanel broadcast; rejection (no receiver) is expected and ignored. */
function notifyAiGrouped(payload) {
    try {
        chrome.runtime.sendMessage({ type: 'routing:aiGrouped', ...payload }).catch(() => {});
    } catch { /* no receiver */ }
}

/**
 * AI Auto Routing branch (FR-3.04/3.05): called only when no explicit rule
 * matched and the AI switch is on. Mutates `st` (lastNav/aiGroups) in place.
 */
async function maybeAiRoute(st, tab, url, now) {
    let domain;
    try {
        domain = normalizeHost(new URL(url).hostname);
    } catch {
        return;
    }
    const decision = decideAiRouting(st, { domain, windowId: tab.windowId, tabId: tab.id }, now);

    if (decision.action === 'join') {
        const alive = await chrome.tabGroups.get(decision.groupId).catch(() => null);
        if (alive && alive.windowId === tab.windowId) {
            await chrome.tabs.group({ tabIds: [tab.id], groupId: decision.groupId });
            // A join is still this window's most recent first-navigation: it must
            // overwrite lastNav, or an older domain's nav would survive an
            // intervening one and pair non-consecutive tabs (FR-3.04).
            st.lastNav = { domain, windowId: tab.windowId, tabId: tab.id, ts: now };
            return;
        }
        delete st.aiGroups[tab.windowId][domain]; // stale mapping (group dissolved)
    }

    if (decision.action === 'create') {
        // Retroactive inclusion (FR-3.05a): the previous tab was already judged;
        // include it only if its LIVE state is still routable.
        const prev = await chrome.tabs.get(decision.prevTabId).catch(() => null);
        const prevEligible = prev
            && prev.windowId === tab.windowId
            && !prev.pinned
            && prev.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE;
        if (prevEligible) {
            const color = VALID_GROUP_COLORS[Math.floor(Math.random() * VALID_GROUP_COLORS.length)];
            const groupId = await chrome.tabs.group({
                tabIds: [prev.id, tab.id],
                createProperties: { windowId: tab.windowId },
            });
            await chrome.tabGroups.update(groupId, { title: domain, color });
            st.aiGroups[tab.windowId] = st.aiGroups[tab.windowId] || {};
            st.aiGroups[tab.windowId][domain] = { groupId, aiNamed: false };
            st.lastNav = null;
            notifyAiGrouped({ windowId: tab.windowId, groupId, domain, tabIds: [prev.id, tab.id] });
            void scheduleAiNaming(groupId, domain, [prev, tab]);
            return;
        }
    }

    st.lastNav = { domain, windowId: tab.windowId, tabId: tab.id, ts: now };
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
        if (rule) {
            await applyRule(tab, rule);                          // FR-2.01
            return;
        }
        if (await ensureAiEnabled()) {
            await maybeAiRoute(st, tab, url, now);               // FR-3.04/3.05
        }
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
        if (!message) return;
        if (message.action === 'routing:claim') {
            mutate(async (st) => {
                addClaims(st.claims, message.urls, Date.now());
            }).then(() => sendResponse({ ok: true }));
            return true; // async response
        }
        if (message.action === 'routing:aiUndo') {               // FR-3.07
            mutate(async (st) => {
                try {
                    // Dissolve the WHOLE group (PRD: 群組解散) — tabs that joined
                    // after creation are members too, so query by groupId rather
                    // than trusting the creation-time tabIds snapshot.
                    const members = await chrome.tabs.query({ groupId: message.groupId }).catch(() => []);
                    const ids = members.length ? members.map(t => t.id) : message.tabIds;
                    await chrome.tabs.ungroup(ids);
                } catch { /* tabs may be gone already */ }
                st.cooldown[`${message.windowId}:${message.domain}`] = Date.now() + AI_UNDO_COOLDOWN_MS;
                const wg = st.aiGroups[message.windowId];
                if (wg) delete wg[message.domain];
            }).then(() => sendResponse({ ok: true }));
            return true; // async response
        }
        // other listeners handle everything else
    });

    chrome.tabGroups.onRemoved.addListener((group) => {
        mutate(async (st) => {
            const wg = st.aiGroups[group.windowId];
            if (!wg) return;
            for (const domain of Object.keys(wg)) {
                if (wg[domain].groupId === group.id) delete wg[domain];
            }
        });
    });

    chrome.windows.onRemoved.addListener((windowId) => {
        mutate(async (st) => {
            delete st.aiGroups[windowId];
            for (const key of Object.keys(st.cooldown)) {
                if (key.startsWith(`${windowId}:`)) delete st.cooldown[key];
            }
        });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[ROUTING_RULES_KEY]) rulesCache = null;
        if (area === 'sync' && changes[ROUTING_ENABLED_KEY]) enabledCache = null;
        if (area === 'sync' && changes[AI_ROUTING_KEY]) aiEnabledCache = null;
    });
}
