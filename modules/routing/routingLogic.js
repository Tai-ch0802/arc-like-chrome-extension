// --- Routing Logic (pure) ---
// Pure decision functions for Tab Routing Rules (BASE-022).
// No chrome.*, no Date.now(): time and tab facts are passed in by the caller
// so every branch is unit-testable in Node (same convention as sync/syncLogic.js).

export const ROUTING_RULES_KEY = 'routingRules';
export const ROUTING_RULES_SCHEMA = 1;
export const MAX_RULES = 50;
export const CLAIM_TTL_MS = 30_000;
export const STARTUP_WINDOW_MS = 10_000;

/**
 * @typedef {Object} RoutingRule
 * @property {string} id
 * @property {boolean} enabled
 * @property {'domain'|'contains'} matchType
 * @property {string} pattern - domain: normalized hostname; contains: raw substring
 * @property {string} groupTitle
 * @property {string|null} groupColor
 * @property {number} order
 * @property {number} createdAt
 * @property {number} updatedAt
 */

export const VALID_MATCH_TYPES = ['domain', 'contains'];
// Chrome's own tabGroups color enum — an invalid color makes tabGroups.update
// throw, which would abort the title write in applyRule.
export const VALID_GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

/**
 * Normalize and validate rule input fields at the storage trust boundary.
 * Partial by design: only the provided keys are checked, so it serves both
 * addRule (full input) and updateRule (patch). Unknown keys are dropped.
 * @param {Object} input
 * @returns {Object|null} the sanitized subset, or null when any provided field is invalid
 */
export function sanitizeRuleInput(input) {
    const out = {};
    if ('matchType' in input) {
        if (!VALID_MATCH_TYPES.includes(input.matchType)) return null;
        out.matchType = input.matchType;
    }
    if ('pattern' in input) {
        const pattern = String(input.pattern || '').trim().slice(0, 256);
        if (!pattern) return null;
        out.pattern = pattern;
    }
    if ('groupTitle' in input) {
        const groupTitle = String(input.groupTitle || '').trim().slice(0, 64);
        if (!groupTitle) return null;
        out.groupTitle = groupTitle;
    }
    if ('groupColor' in input) {
        const color = input.groupColor ?? null;
        if (color !== null && !VALID_GROUP_COLORS.includes(color)) return null;
        out.groupColor = color;
    }
    if ('enabled' in input) {
        out.enabled = !!input.enabled;
    }
    return out;
}

/** Lowercase a hostname and strip a leading "www.". */
export function normalizeHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    return h.startsWith('www.') ? h.slice(4) : h;
}

/** Only http/https navigations participate in routing (FR-2.01). */
export function isRealHttpUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
}

/**
 * Canonical claim key for a URL: href with the hash dropped, so the claim
 * registered for a reading-list entry matches the committed navigation URL.
 * Invalid URLs fall back to the raw string.
 */
export function normalizeUrlForClaim(url) {
    try {
        const u = new URL(url);
        u.hash = '';
        return u.href;
    } catch {
        return String(url || '');
    }
}

/**
 * First enabled rule that matches wins (FR-1.03). Rules are evaluated in the
 * given array order — callers pass the list already sorted by `order`.
 * @param {string} url
 * @param {RoutingRule[]} rules
 * @returns {RoutingRule|null}
 */
export function matchRule(url, rules) {
    if (!isRealHttpUrl(url) || !Array.isArray(rules)) return null;
    let host;
    try {
        host = normalizeHost(new URL(url).hostname);
    } catch {
        return null;
    }
    for (const rule of rules) {
        if (!rule || rule.enabled === false) continue;
        if (rule.matchType === 'domain') {
            if (host === normalizeHost(rule.pattern)) return rule;
        } else if (rule.matchType === 'contains') {
            if (rule.pattern && url.includes(rule.pattern)) return rule;
        }
    }
    return null;
}

/** Sort helper: stable order for display and matching. */
export function sortRules(rules) {
    return [...(rules || [])].sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
}

/**
 * Browser-session-restore heuristic (SA §5.3): a tab created inside the
 * startup burst window, carrying a URL from birth and with no opener, is a
 * restored tab — skip it. Desktop-app-opened links (same shape but outside
 * the window) still route.
 * ponytail: 10s startup window is a heuristic; switch to an idle-based probe
 * if large session restores are reported to overflow it.
 * @param {{hadUrlAtCreate: boolean, hasOpener: boolean, createdAt: number}|undefined} candidate
 * @param {number} startupUntil - epoch ms; 0 when no startup seen this session
 */
export function isStartupRestored(candidate, startupUntil) {
    if (!candidate || !startupUntil) return false;
    return candidate.hadUrlAtCreate && !candidate.hasOpener && candidate.createdAt <= startupUntil;
}

/**
 * Consume one claim for the URL if present and not expired (FR-2.07).
 * Mutates `claims` in place (the caller persists the surrounding state).
 * Expired entries encountered on the way are pruned lazily.
 * @param {{[url: string]: {count: number, expiresAt: number}}} claims
 * @param {string} url
 * @param {number} now
 * @returns {boolean} true if a claim was consumed
 */
export function consumeClaim(claims, url, now) {
    if (!claims) return false;
    const key = normalizeUrlForClaim(url);
    const entry = claims[key];
    if (!entry) return false;
    if (entry.expiresAt <= now || entry.count <= 0) {
        delete claims[key];
        return false;
    }
    entry.count -= 1;
    if (entry.count <= 0) delete claims[key];
    return true;
}

/** Register claims for a batch of URLs (count semantics for duplicates). */
export function addClaims(claims, urls, now, ttlMs = CLAIM_TTL_MS) {
    for (const url of urls || []) {
        if (!url) continue;
        const key = normalizeUrlForClaim(url);
        const entry = claims[key];
        if (entry && entry.expiresAt > now) {
            entry.count += 1;
            entry.expiresAt = now + ttlMs;
        } else {
            claims[key] = { count: 1, expiresAt: now + ttlMs };
        }
    }
    return claims;
}

/** Drop expired claim entries (lazy sweep, called inside mutations). */
export function pruneClaims(claims, now) {
    for (const key of Object.keys(claims || {})) {
        if (claims[key].expiresAt <= now || claims[key].count <= 0) delete claims[key];
    }
    return claims;
}
