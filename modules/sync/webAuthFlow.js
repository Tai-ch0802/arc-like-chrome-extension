/**
 * @file webAuthFlow.js
 * Google OAuth via `chrome.identity.launchWebAuthFlow` (implicit grant) for browsers
 * where `chrome.identity.getAuthToken` is unusable (e.g. Dia). Every effect
 * (identity, storage, clock, randomness, fetch) is injected, so this module is
 * unit-testable in plain Node. It never touches `chrome`, `fetch`, `Date`, `crypto`
 * or `console` directly.
 *
 * SECURITY: the access token is never logged or placed in error messages.
 */

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const WEB_AUTH_STORAGE_KEY = 'driveWebAuth';

const DEFAULT_EXPIRES_IN_SEC = 3600;
const MAX_EXPIRES_IN_SEC = 86400;

/**
 * Build the Google OAuth authorization URL (implicit grant).
 * @param {{clientId:string, redirectUri:string, scopes:string[], state:string, prompt?:string, loginHint?:string}} p
 * @returns {string}
 */
export function buildAuthUrl({ clientId, redirectUri, scopes, state, prompt, loginHint }) {
    if (typeof state !== 'string' || !state) throw new Error('web-auth: state is required');
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: scopes.join(' '),
        state,
        include_granted_scopes: 'true'
    });
    if (prompt) params.set('prompt', prompt);
    if (typeof loginHint === 'string' && loginHint) params.set('login_hint', loginHint);
    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Parse and validate the final redirect URL of an implicit-grant flow.
 * Token and state are accepted from the URL fragment only; `error` is also
 * honoured in the query string (Google may place it there).
 * `expiresIn` is 3600 when `expires_in` is absent, 0 (already expired) when present
 * but invalid/non-positive, and capped at 86400.
 * @param {string} url
 * @param {{expectedState:string, redirectOrigin:string}} opts
 * @returns {{accessToken:string, expiresIn:number}}
 * @throws {Error} message starts with `web-auth:`
 */
export function parseRedirect(url, { expectedState, redirectOrigin }) {
    let u;
    try {
        u = new URL(url);
    } catch {
        throw new Error('web-auth: invalid redirect url');
    }
    if (u.origin !== redirectOrigin) throw new Error('web-auth: unexpected redirect origin');

    const frag = new URLSearchParams(u.hash.replace(/^#\/?/, ''));

    const error = frag.get('error') ?? u.searchParams.get('error');
    if (error) throw new Error(`web-auth: authorization error: ${error}`);

    const accessToken = frag.get('access_token');
    if (!accessToken) throw new Error('web-auth: no access_token in fragment');

    const state = frag.get('state');
    if (!state || state !== expectedState) throw new Error('web-auth: state mismatch');

    const raw = frag.get('expires_in');
    let expiresIn = DEFAULT_EXPIRES_IN_SEC;
    if (raw !== null) {
        const n = Number(raw);
        expiresIn = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_EXPIRES_IN_SEC) : (n === Infinity ? MAX_EXPIRES_IN_SEC : 0);
        if (raw.trim() === '') expiresIn = 0;
    }
    return { accessToken, expiresIn };
}

/**
 * Create a web auth flow controller with injected effects.
 * @param {object} deps
 * @param {{launchWebAuthFlow:(o:{url:string,interactive:boolean})=>Promise<string>, getRedirectURL:()=>string}} deps.identity
 * @param {{get:(k:string)=>Promise<any>, set:(k:string,v:any)=>Promise<void>, remove:(k:string)=>Promise<void>}} deps.storage
 * @param {()=>number} deps.now
 * @param {()=>string} deps.randomState
 * @param {(url:string, init?:object)=>Promise<{ok:boolean,status:number,json:()=>Promise<any>,text:()=>Promise<string>}>} deps.fetchFn
 * @param {string} deps.clientId
 * @param {string[]} deps.scopes
 * @param {number} [deps.silentRetryIntervalMs]
 * @param {number} [deps.expirySkewMs]
 */
export function createWebAuthFlow({
    identity,
    storage,
    now,
    randomState,
    fetchFn,
    clientId,
    scopes,
    silentRetryIntervalMs = 5 * 60 * 1000,
    expirySkewMs = 60 * 1000
}) {
    const getRecord = async () => (await storage.get(WEB_AUTH_STORAGE_KEY)) || null;

    /** Run one launchWebAuthFlow round trip and return the parsed token. */
    async function authorize({ interactive, prompt, loginHint }) {
        const redirectUri = identity.getRedirectURL();
        const state = randomState();
        const url = buildAuthUrl({ clientId, redirectUri, scopes, state, prompt, loginHint });
        const finalUrl = await identity.launchWebAuthFlow({ url, interactive });
        const { accessToken, expiresIn } = parseRedirect(finalUrl, {
            expectedState: state,
            redirectOrigin: new URL(redirectUri).origin
        });
        const expiresAt = expiresIn > 0 ? now() + expiresIn * 1000 - expirySkewMs : now();
        return { accessToken, expiresAt };
    }

    async function fetchEmail(accessToken) {
        try {
            const res = await fetchFn(GOOGLE_USERINFO_ENDPOINT, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!res || !res.ok) return '';
            const body = await res.json();
            return (body && typeof body.email === 'string') ? body.email : '';
        } catch {
            return '';
        }
    }

    let inflight = null;

    /** Silent refresh; returns the new token or null. Never throws. */
    async function silentRefresh(rec) {
        try {
            // Record the attempt first so a crash/failure still throttles.
            await storage.set(WEB_AUTH_STORAGE_KEY, { ...rec, silentTriedAt: now() });
            const { accessToken, expiresAt } = await authorize({
                interactive: false,
                prompt: 'none',
                loginHint: rec.email || undefined
            });
            // Re-read: disconnect() may have removed the record meanwhile.
            const fresh = await getRecord();
            if (!fresh) return null;
            const { silentTriedAt: _drop, ...rest } = fresh;
            await storage.set(WEB_AUTH_STORAGE_KEY, { ...rest, accessToken, expiresAt });
            return accessToken;
        } catch {
            return null;
        }
    }

    return {
        /** Interactive consent flow; persists and returns the new record. */
        async connectInteractive() {
            const existing = await getRecord();
            const { accessToken, expiresAt } = await authorize({
                interactive: true,
                prompt: 'consent',
                loginHint: existing && existing.email ? existing.email : undefined
            });
            const email = await fetchEmail(accessToken);
            const record = { accessToken, expiresAt, email };
            await storage.set(WEB_AUTH_STORAGE_KEY, record);
            return record;
        },

        /**
         * Return a usable token, silently refreshing when expired (throttled).
         * Never throws.
         * @param {{allowSilent?:boolean}} [opts]
         * @returns {Promise<string|null>}
         */
        async getValidToken({ allowSilent = true } = {}) {
            // Single-flight: share an in-flight silent refresh.
            if (inflight) return inflight;
            try {
                const rec = await getRecord();
                if (!rec) return null;
                if (rec.accessToken && rec.expiresAt > now()) return rec.accessToken;
                if (!allowSilent) return null;
                if (inflight) return inflight;
                const since = rec.silentTriedAt === undefined ? Infinity : now() - rec.silentTriedAt;
                // since < 0 means the clock went backwards: allow the attempt.
                if (since >= 0 && since < silentRetryIntervalMs) return null;
                inflight = silentRefresh(rec).finally(() => { inflight = null; });
                return await inflight;
            } catch {
                return null;
            }
        },

        /** @returns {Promise<boolean>} true when a record exists (regardless of expiry). */
        async hasRecord() {
            return (await getRecord()) !== null;
        },

        /** @returns {Promise<string>} stored email or ''. */
        async getEmail() {
            const rec = await getRecord();
            return (rec && rec.email) || '';
        },

        /** @returns {Promise<object|null>} the stored record. */
        getRecord,

        /** Invalidate the access token (e.g. after a 401) but keep the record. */
        async clearAccessToken() {
            const rec = await getRecord();
            if (!rec) return;
            await storage.set(WEB_AUTH_STORAGE_KEY, { ...rec, accessToken: '', expiresAt: 0 });
        },

        /** Best-effort revoke, then remove the record. */
        async disconnect() {
            const rec = await getRecord();
            if (rec && rec.accessToken) {
                try {
                    await fetchFn(GOOGLE_REVOKE_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `token=${encodeURIComponent(rec.accessToken)}`
                    });
                } catch {
                    /* best-effort */
                }
            }
            await storage.remove(WEB_AUTH_STORAGE_KEY);
        }
    };
}
