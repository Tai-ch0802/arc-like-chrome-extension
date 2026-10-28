/**
 * @file driveAuth.js
 * Google Drive auth facade (ISSUE-257 WP2).
 *
 * Two mutually exclusive, persisted modes:
 * - `chrome`: Google Chrome's `chrome.identity.getAuthToken` (browser account
 *   layer caches the token; survives SW termination; no refresh token here).
 * - `web`: every other Chromium brand (Dia) — `launchWebAuthFlow` implicit
 *   grant via {@link module:modules/sync/webAuthFlow}. Token + email live in
 *   `chrome.storage.local` only.
 *
 * The mode is decided from the browser brand at connect time and stored as
 * `driveAuthMode`. Chrome NEVER falls back to web (PRD FR-2.04): a failed
 * interactive getAuthToken is simply a failure. In web mode `isConnected()`
 * means "a record exists" (even if the token expired) so the engine keeps
 * running and `getToken(false)` gets to attempt the throttled silent refresh;
 * a refresh failure returns null and the engine writes `needs-auth` as it
 * always did (SA §3.2).
 *
 * The public function exports keep the pre-existing names used by
 * googleDriveProvider / background / options; {@link createDriveAuth} is the
 * injectable core for unit tests. SECURITY: tokens never reach logs or error
 * messages.
 */
import { getStorage, setStorage, removeStorage } from '../apiManager.js';
import { getBrowserInfo } from '../utils/browserCapabilities.js';
import { createWebAuthFlow } from './webAuthFlow.js';
import { WEB_CLIENT_ID, USERINFO_EMAIL_SCOPE } from './oauthConfig.js';

const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
/** storage.local: 'chrome' | 'web' (absent until the first successful connect). */
export const AUTH_MODE_KEY = 'driveAuthMode';
/** storage.local: account email (web mode only; '' / absent in chrome mode). */
export const ACCOUNT_EMAIL_KEY = 'driveAccountEmail';

/**
 * @param {Object} deps
 * @param {Object} deps.identity        chrome.identity (getAuthToken/removeCachedAuthToken/clearAllCachedAuthTokens)
 * @param {{get:Function,set:Function,remove:Function}} deps.storage  async KV over storage.local
 * @param {() => {isGoogleChrome:boolean}} deps.getInfo
 * @param {() => Object} deps.createWebFlow  lazily builds the webAuthFlow object
 * @param {Function} deps.fetchFn
 */
export function createDriveAuth({ identity, storage, getInfo, createWebFlow, fetchFn }) {
    let webFlow = null;
    const web = () => { if (!webFlow) webFlow = createWebFlow(); return webFlow; };
    const brandMode = () => (getInfo().isGoogleChrome ? 'chrome' : 'web');

    /** @returns {Promise<'chrome'|'web'>} persisted mode, else derived from the brand. */
    async function getAuthMode() {
        const stored = await storage.get(AUTH_MODE_KEY);
        if (stored === 'chrome' || stored === 'web') return stored;
        return brandMode();
    }

    async function chromeToken(interactive) {
        if (!identity || typeof identity.getAuthToken !== 'function') return null;
        try {
            const result = await identity.getAuthToken({ interactive });
            // Chrome returns either a string token (older) or { token } (newer).
            const token = typeof result === 'string' ? result : (result && result.token);
            return token || null;
        } catch {
            return null; // not signed in / consent denied / no client_id
        }
    }

    /**
     * @param {boolean} [interactive=false]
     * @returns {Promise<string|null>}
     */
    async function getToken(interactive = false) {
        const mode = await getAuthMode();
        if (mode === 'chrome') return chromeToken(interactive);
        if (interactive) {
            try {
                const record = await web().connectInteractive();
                return (record && record.accessToken) || null;
            } catch {
                return null;
            }
        }
        return web().getValidToken({ allowSilent: true });
    }

    /** @returns {Promise<boolean>} */
    async function isConnected() {
        const mode = await getAuthMode();
        if (mode === 'chrome') return Boolean(await chromeToken(false));
        return web().hasRecord();
    }

    /** Interactive connect (user gesture). Persists the mode only on success. @returns {Promise<boolean>} */
    async function connect() {
        const mode = brandMode();
        if (mode === 'chrome') {
            const ok = Boolean(await chromeToken(true));
            if (ok) await storage.set(AUTH_MODE_KEY, 'chrome');
            return ok;
        }
        try {
            const record = await web().connectInteractive();
            await storage.set(AUTH_MODE_KEY, 'web');
            await storage.set(ACCOUNT_EMAIL_KEY, (record && record.email) || '');
            return true;
        } catch {
            return false;
        }
    }

    /** Full disconnect: revoke + flush, then forget mode and email. */
    async function disconnect() {
        const mode = await getAuthMode();
        if (mode === 'chrome') {
            const token = await chromeToken(false);
            if (token) {
                try {
                    await fetchFn(REVOKE_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `token=${encodeURIComponent(token)}`,
                    });
                } catch { /* best-effort */ }
                try { await identity.removeCachedAuthToken({ token }); } catch { /* best-effort */ }
            }
            try { if (identity.clearAllCachedAuthTokens) await identity.clearAllCachedAuthTokens(); } catch { /* best-effort */ }
        } else {
            try { await web().disconnect(); } catch { /* best-effort */ }
        }
        await storage.remove(ACCOUNT_EMAIL_KEY);
        await storage.remove(AUTH_MODE_KEY);
    }

    /** @returns {Promise<string>} '' when unknown (always '' in chrome mode). */
    async function getAccountEmail() {
        return (await storage.get(ACCOUNT_EMAIL_KEY)) || '';
    }

    async function flushToken(token) {
        const mode = await getAuthMode();
        if (mode === 'chrome') {
            try { await identity.removeCachedAuthToken({ token }); } catch { /* best-effort */ }
        } else {
            try { await web().clearAccessToken(); } catch { /* best-effort */ }
        }
    }

    /**
     * Authenticated fetch against Drive REST. On 401 flushes the stale token and
     * retries ONCE. Throws only on network error or when no token is obtainable.
     * @param {string} url
     * @param {RequestInit} [init]
     * @returns {Promise<Response>}
     */
    async function authedFetch(url, init = {}) {
        let token = await getToken(false);
        if (!token) throw new Error('drive-auth: not connected');
        const doFetch = (tok) => fetchFn(url, {
            ...init,
            headers: { ...(init.headers || {}), Authorization: `Bearer ${tok}` },
        });
        let res = await doFetch(token);
        if (res.status === 401) {
            await flushToken(token);
            token = await getToken(false);
            if (!token) throw new Error('drive-auth: re-auth required');
            res = await doFetch(token);
        }
        return res;
    }

    return { getAuthMode, getToken, isConnected, connect, disconnect, getAccountEmail, authedFetch };
}

// --- Default instance (real chrome.* wiring), created lazily --------------
let defaultAuth = null;
function instance() {
    if (!defaultAuth) {
        const identity = (typeof chrome !== 'undefined' && chrome.identity) || null;
        const kv = {
            get: (k) => getStorage('local', [k]).then((r) => r[k]),
            set: (k, v) => setStorage('local', { [k]: v }),
            remove: (k) => removeStorage('local', k),
        };
        const manifestScopes = (() => {
            try { return chrome.runtime.getManifest().oauth2.scopes || []; } catch { return []; }
        })();
        defaultAuth = createDriveAuth({
            identity,
            storage: kv,
            getInfo: getBrowserInfo,
            fetchFn: (...args) => fetch(...args),
            createWebFlow: () => createWebAuthFlow({
                identity,
                storage: kv,
                now: () => Date.now(),
                randomState: () => crypto.randomUUID(),
                fetchFn: (...args) => fetch(...args),
                clientId: WEB_CLIENT_ID,
                scopes: [...manifestScopes, USERINFO_EMAIL_SCOPE],
            }),
        });
    }
    return defaultAuth;
}

/** @returns {Promise<'chrome'|'web'>} */
export const getAuthMode = () => instance().getAuthMode();
/** @param {boolean} [interactive] @returns {Promise<string|null>} */
export const getToken = (interactive = false) => instance().getToken(interactive);
/** @returns {Promise<boolean>} */
export const isConnected = () => instance().isConnected();
/** Interactive connect (call from a user gesture). @returns {Promise<boolean>} */
export const connect = () => instance().connect();
/** @returns {Promise<void>} */
export const disconnect = () => instance().disconnect();
/** @returns {Promise<string>} */
export const getAccountEmail = () => instance().getAccountEmail();
/** @param {string} url @param {RequestInit} [init] @returns {Promise<Response>} */
export const authedFetch = (url, init = {}) => instance().authedFetch(url, init);
