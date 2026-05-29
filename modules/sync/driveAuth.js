/**
 * Google Drive auth wrapper (chrome.identity.getAuthToken).
 *
 * Token lifecycle (MV3): Chrome caches the OAuth access token in the identity
 * layer (survives service-worker termination); we never persist a refresh token.
 * On a 401 from Drive we flush the stale token and re-acquire once.
 *
 * NOTE: requires a real oauth2 client_id in manifest.json (placeholder until the
 * Google Cloud OAuth client is provisioned) — until then getAuthToken rejects and
 * isConnected() returns false, which keeps the whole sync layer inert (NoopSyncProvider).
 */

const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

function identityAvailable() {
    return typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getAuthToken === 'function';
}

/**
 * Acquire an OAuth token. interactive=true may show the consent/sign-in UI
 * (call only from a user gesture, e.g. the options Sync "Connect" button).
 * @param {boolean} interactive
 * @returns {Promise<string|null>} token, or null if unavailable/denied
 */
export async function getToken(interactive = false) {
    if (!identityAvailable()) return null;
    try {
        // MV3: getAuthToken returns a Promise (no callback needed).
        const result = await chrome.identity.getAuthToken({ interactive });
        // Chrome returns either a string token (older) or { token } (newer); handle both.
        const token = typeof result === 'string' ? result : (result && result.token);
        return token || null;
    } catch (e) {
        // Not signed in / consent denied / no client_id configured.
        return null;
    }
}

/** True if a token can be obtained non-interactively (i.e. already connected). */
export async function isConnected() {
    const token = await getToken(false);
    return Boolean(token);
}

/** Interactive connect (call from a user gesture). Returns true on success. */
export async function connect() {
    const token = await getToken(true);
    return Boolean(token);
}

/** Remove a specific cached token (used on 401). */
async function removeCachedToken(token) {
    if (!identityAvailable() || !token) return;
    try { await chrome.identity.removeCachedAuthToken({ token }); } catch { /* best-effort */ }
}

/**
 * Full disconnect: flush all cached tokens AND best-effort server-side revoke,
 * so the user is genuinely signed out (next connect shows the account picker).
 */
export async function disconnect() {
    if (!identityAvailable()) return;
    const token = await getToken(false);
    if (token) {
        // Best-effort server revoke (don't block on failure / network).
        try { await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: 'POST' }); } catch { /* ignore */ }
        await removeCachedToken(token);
    }
    try {
        if (chrome.identity.clearAllCachedAuthTokens) {
            await chrome.identity.clearAllCachedAuthTokens();
        }
    } catch { /* best-effort */ }
}

/**
 * Authenticated fetch against Drive REST. Adds the Bearer token; on 401 flushes
 * the stale token and retries ONCE with a fresh token. Never logs the token.
 * Returns the Response (caller inspects .ok/.status). Throws only on network error
 * or if no token is obtainable.
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function authedFetch(url, init = {}) {
    let token = await getToken(false);
    if (!token) throw new Error('drive-auth: not connected');
    const doFetch = (tok) => fetch(url, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${tok}` },
    });
    let res = await doFetch(token);
    if (res.status === 401) {
        await removeCachedToken(token);
        token = await getToken(false);
        if (!token) throw new Error('drive-auth: re-auth required');
        res = await doFetch(token);
    }
    return res;
}
