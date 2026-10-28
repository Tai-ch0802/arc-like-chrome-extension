/**
 * @file browserCapabilities.js
 * Browser brand detection + per-device capability flags (ISSUE-257).
 *
 * Why: Chromium forks such as Dia ship the same UA string as Chrome but lack
 * pieces this extension relies on — `chrome.tabs.group()` throws
 * `Error: No window` on every call, and there is no browser-level Google
 * account for `chrome.identity.getAuthToken`. Rather than special-casing a
 * vendor, we (1) detect "is this Google Chrome" from `userAgentData.brands`
 * (the UA string is useless for this) and (2) remember, per device, which
 * capability has been observed to be broken so the UI can hide what cannot
 * work. Flags live in chrome.storage.local and never sync (PRD FR-1.05).
 *
 * The pure helpers here have no `chrome` dependency so they run in Node tests;
 * the stateful store takes an injected key-value adapter.
 */

/** storage.local key: tab-group API observed unusable on this device. */
export const CAP_TAB_GROUPS = 'tabGroupsUnsupported';
/** storage.local key: side panel could not be opened on this device. */
export const CAP_SIDE_PANEL = 'sidePanelUnavailable';
const ALL_FLAGS = [CAP_TAB_GROUPS, CAP_SIDE_PANEL];

/**
 * Dia-specific failure text from chrome.tabs.group (SPIKE §2): the BARE
 * message, optionally "Error: "-prefixed / dot-terminated. Anchored on purpose:
 * Chromium's own "No window with id: N." (target window closed mid-call) is a
 * recoverable error and must never match.
 */
const NO_WINDOW_RE = /^(?:error:\s*)?no window\.?$/i;
/** Non-Chrome brands: generic failures this many times in a row ⇒ unsupported. */
const NON_CHROME_FAILURE_STREAK = 2;
/**
 * Errors Chromium raises for ordinary, recoverable reasons (stale ids, a tab
 * mid-drag). They say nothing about the browser's capability and must never
 * count toward the unsupported streak on any brand (Edge/Brave/Chrome for
 * Testing all report a non-"Google Chrome" brand).
 */
const TRANSIENT_RE = /no tab with id|no group with id|no window with id|cannot be edited|dragging|tab strip/i;

/**
 * @param {string|undefined} errMsg
 * @returns {boolean} true for Chromium's recoverable tab-group errors
 */
export function isTransientTabGroupError(errMsg) {
    return TRANSIENT_RE.test(String(errMsg || ''));
}

/**
 * Derive brand info from `navigator.userAgentData.brands` with a UA fallback.
 * Brands absent (older engines, Node) ⇒ assume Chrome: that is the conservative
 * choice because every Chrome-only path then stays on its proven code.
 *
 * @param {Array<{brand:string, version:string}>|undefined|null} brands
 * @param {string} [uaString]
 * @returns {{isGoogleChrome:boolean, brand:string, majorVersion:number}}
 */
export function parseBrowserInfo(brands, uaString = '') {
    const list = Array.isArray(brands) ? brands.filter((b) => b && typeof b.brand === 'string') : [];
    const toMajor = (v) => {
        const n = parseInt(String(v || ''), 10);
        return Number.isFinite(n) ? n : 0;
    };
    if (list.length > 0) {
        const chrome = list.find((b) => b.brand === 'Google Chrome');
        if (chrome) return { isGoogleChrome: true, brand: 'Google Chrome', majorVersion: toMajor(chrome.version) };
        // Prefer a real vendor brand (Microsoft Edge, Brave…) over the generic
        // "Chromium" entry and the GREASE "Not A Brand" placeholders.
        // GREASE placeholders vary by version: "Not A Brand", "Not_A Brand", "Not:A-Brand", "Not)A;Brand"…
        const isPlaceholder = (b) => /not[\W_]{0,3}a[\W_]{0,3}brand/i.test(b.brand);
        const vendor = list.find((b) => !isPlaceholder(b) && b.brand !== 'Chromium');
        const chromium = list.find((b) => b.brand === 'Chromium');
        const pick = vendor || chromium || list.find((b) => !isPlaceholder(b)) || list[0];
        return { isGoogleChrome: false, brand: pick.brand, majorVersion: toMajor((chromium || pick).version) };
    }
    const m = /Chrome\/(\d+)/.exec(uaString || '');
    return { isGoogleChrome: true, brand: 'unknown', majorVersion: m ? toMajor(m[1]) : 0 };
}

let cachedInfo = null;
let infoOverride = null;

/**
 * Brand info for the running context (cached). Reads `navigator.userAgentData`
 * when present (service worker and extension pages both expose it).
 * @returns {{isGoogleChrome:boolean, brand:string, majorVersion:number}}
 */
export function getBrowserInfo() {
    if (infoOverride) return infoOverride;
    if (cachedInfo) return cachedInfo;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const brands = nav && nav.userAgentData ? nav.userAgentData.brands : undefined;
    cachedInfo = parseBrowserInfo(brands, nav ? nav.userAgent : '');
    return cachedInfo;
}

/** TEST-ONLY: force a brand (pass null to clear). */
export function setBrowserInfoOverride(info) {
    infoOverride = info || null;
}

/**
 * Should a `chrome.tabs.group` failure mark tab groups as unsupported here?
 * - The Dia-specific "No window" text is conclusive on any brand.
 * - On a non-Chrome brand, two consecutive generic failures are enough.
 * - On Google Chrome, generic failures are transient (e.g. "Tabs cannot be
 *   edited right now (user may be dragging a tab)") and NEVER set the flag,
 *   otherwise one drag collision would hide Smart Group forever (FR-1.01a).
 *
 * @param {string|undefined} errMsg
 * @param {{isGoogleChrome:boolean}} info
 * @param {number} consecutiveFailures 1-based streak including this failure
 * @returns {boolean}
 */
export function classifyTabGroupFailure(errMsg, info, consecutiveFailures) {
    if (NO_WINDOW_RE.test(String(errMsg || '').trim())) return true;
    if (isTransientTabGroupError(errMsg)) return false;
    if (info && info.isGoogleChrome) return false;
    return (consecutiveFailures || 0) >= NON_CHROME_FAILURE_STREAK;
}

/**
 * What the action-icon click should do (WP0). On Google Chrome the browser's
 * own `openPanelOnActionClick` behavior handles it, so we must not touch it
 * (double handling would make the panel impossible to close).
 *
 * @param {{isGoogleChrome:boolean, panelOpen:boolean, sidePanelUnavailable:boolean}} ctx
 * @returns {'noop'|'open'|'close'|'options'}
 */
export function decideActionClick({ isGoogleChrome, panelOpen, sidePanelUnavailable }) {
    if (isGoogleChrome) return 'noop';
    if (sidePanelUnavailable) return 'options';
    return panelOpen ? 'close' : 'open';
}

/**
 * A stored flag is stale once the browser brand or major version differs from
 * the one that recorded it (a browser upgrade may have fixed the API) — the
 * only automatic recovery path (FR-1.01b).
 *
 * @param {{brand?:string, majorVersion?:number}|undefined} flag
 * @param {{brand:string, majorVersion:number}} info
 * @returns {boolean}
 */
export function shouldResetCapabilityFlag(flag, info) {
    if (!flag || typeof flag !== 'object') return false;
    return flag.brand !== info.brand || flag.majorVersion !== info.majorVersion;
}

/**
 * Stateful flag store over an injected async key-value adapter (defaults are
 * wired in apiManager.js, which owns all chrome.* access).
 *
 * @param {Object} deps
 * @param {{get:(k:string)=>Promise<any>, set:(k:string,v:any)=>Promise<void>, remove:(k:string)=>Promise<void>}} deps.storage
 * @param {() => {isGoogleChrome:boolean, brand:string, majorVersion:number}} deps.getInfo
 * @param {() => number} [deps.now]
 */
export function createCapabilityStore({ storage, getInfo, now = () => Date.now() }) {
    /** @type {Map<string, any>} name → flag (undefined = known absent) */
    const cache = new Map();

    async function read(name) {
        if (cache.has(name)) return cache.get(name);
        const value = await storage.get(name);
        cache.set(name, value);
        return value;
    }

    return {
        /** @param {string} name @returns {Promise<boolean>} */
        async isUnsupported(name) {
            const flag = await read(name);
            return Boolean(flag && flag.unsupported);
        },
        /** @param {string} name @returns {Promise<any>} the stored flag object or undefined */
        async getFlag(name) {
            return read(name);
        },
        /**
         * @param {string} name
         * @param {Object} [extra] diagnostic fields (e.g. `{ reason }`) kept with the flag
         */
        async markUnsupported(name, extra = {}) {
            const info = getInfo();
            const flag = { ...extra, unsupported: true, brand: info.brand, majorVersion: info.majorVersion, at: now() };
            cache.set(name, flag);
            await storage.set(name, flag);
        },
        /** Drop flags recorded by a different brand/major version. @returns {Promise<string[]>} reset names */
        async resetIfBrowserChanged() {
            const info = getInfo();
            const reset = [];
            for (const name of ALL_FLAGS) {
                const flag = await read(name);
                if (shouldResetCapabilityFlag(flag, info)) {
                    cache.set(name, undefined);
                    await storage.remove(name);
                    reset.push(name);
                }
            }
            return reset;
        },
        /** Forget a cached value (call from a storage.onChanged handler). @param {string} name */
        invalidate(name) {
            cache.delete(name);
        },
    };
}
