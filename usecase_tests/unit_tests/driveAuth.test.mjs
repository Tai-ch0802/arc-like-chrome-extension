/**
 * ISSUE-257 WP2 — driveAuth facade: Google Chrome keeps chrome.identity
 * .getAuthToken; every other Chromium brand (Dia) uses the launchWebAuthFlow
 * implicit grant (modules/sync/webAuthFlow.js). The mode is decided at connect
 * time from the browser brand, persisted as `driveAuthMode`, and Chrome never
 * falls back to web mode (PRD FR-2.04). Web mode: `isConnected` means "a
 * record exists" so an expired token still gets a silent-refresh chance
 * inside getToken (SA §3.2).
 */
import { createDriveAuth } from '../../modules/sync/driveAuth.js';

const CHROME = { isGoogleChrome: true, brand: 'Google Chrome', majorVersion: 156 };
const DIA = { isGoogleChrome: false, brand: 'Chromium', majorVersion: 156 };

function fakeKv(initial = {}) {
    const data = { ...initial };
    return {
        data,
        get: async (k) => data[k],
        set: async (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); },
        remove: async (k) => { delete data[k]; },
    };
}

function fakeWebFlow(over = {}) {
    const calls = { connect: 0, getValid: [], disconnect: 0, clear: 0 };
    let record = over.record || null;
    return {
        calls,
        flow: {
            connectInteractive: async () => { calls.connect += 1; if (over.connectError) throw over.connectError; record = { accessToken: 'web-tok', expiresAt: 10, email: over.email ?? 'me@example.com' }; return record; },
            // After clearAccessToken() the real flow silently refreshes; the fake returns 'refreshed'.
            getValidToken: async (opts) => { calls.getValid.push(opts); return over.validToken === undefined ? (record ? (record.accessToken || 'refreshed') : null) : over.validToken; },
            hasRecord: async () => Boolean(record),
            getEmail: async () => (record ? record.email : ''),
            getRecord: async () => record,
            clearAccessToken: async () => { calls.clear += 1; if (record) record.accessToken = ''; },
            disconnect: async () => { calls.disconnect += 1; record = null; },
        },
    };
}

function fakeIdentity({ token = 'chrome-tok', fail = false } = {}) {
    const calls = { getAuthToken: [], removed: [], clearedAll: 0 };
    return {
        calls,
        identity: {
            getAuthToken: async (opts) => { calls.getAuthToken.push(opts); if (fail) throw new Error('OAuth2 not granted or revoked.'); return { token }; },
            removeCachedAuthToken: async ({ token: t }) => { calls.removed.push(t); },
            clearAllCachedAuthTokens: async () => { calls.clearedAll += 1; },
        },
    };
}

function build({ info = DIA, kv = fakeKv(), identity = fakeIdentity(), web = fakeWebFlow(), fetchFn } = {}) {
    const fetchCalls = [];
    const auth = createDriveAuth({
        identity: identity.identity,
        storage: kv,
        getInfo: () => info,
        createWebFlow: () => web.flow,
        fetchFn: fetchFn || (async (url, init) => { fetchCalls.push({ url, init }); return { ok: true, status: 200 }; }),
    });
    return { auth, kv, identity, web, fetchCalls };
}

describe('driveAuth facade — mode selection', () => {
    it('derives the mode from the brand before anything is persisted', async () => {
        expect(await build({ info: CHROME }).auth.getAuthMode()).toBe('chrome');
        expect(await build({ info: DIA }).auth.getAuthMode()).toBe('web');
    });

    it('a persisted mode is authoritative over the brand', async () => {
        const { auth } = build({ info: DIA, kv: fakeKv({ driveAuthMode: 'chrome' }) });
        expect(await auth.getAuthMode()).toBe('chrome');
    });
});

describe('driveAuth facade — Google Chrome', () => {
    it('connect uses getAuthToken interactively, persists mode chrome, never touches the web flow', async () => {
        const { auth, kv, identity, web } = build({ info: CHROME });
        expect(await auth.connect()).toBe(true);
        expect(identity.calls.getAuthToken).toEqual([{ interactive: true }]);
        expect(kv.data.driveAuthMode).toBe('chrome');
        expect(web.calls.connect).toBe(0);
    });

    it('a failed interactive getAuthToken returns false and does NOT fall back to the web flow', async () => {
        const { auth, web } = build({ info: CHROME, identity: fakeIdentity({ fail: true }) });
        expect(await auth.connect()).toBe(false);
        expect(web.calls.connect).toBe(0);
        expect(await auth.isConnected()).toBe(false);
    });

    it('getToken(false) / isConnected use the non-interactive path; email is empty in chrome mode', async () => {
        const { auth, identity } = build({ info: CHROME });
        expect(await auth.getToken(false)).toBe('chrome-tok');
        expect(identity.calls.getAuthToken).toEqual([{ interactive: false }]);
        expect(await auth.isConnected()).toBe(true);
        expect(await auth.getAccountEmail()).toBe('');
    });

    it('authedFetch retries once after a 401 by flushing the cached token', async () => {
        let n = 0;
        const fetchFn = async (url, init) => { n += 1; return n === 1 ? { ok: false, status: 401, text: async () => '' } : { ok: true, status: 200, _auth: init.headers.Authorization }; };
        const { auth, identity } = build({ info: CHROME, fetchFn });
        const res = await auth.authedFetch('https://www.googleapis.com/x');
        expect(res.ok).toBe(true);
        expect(identity.calls.removed).toEqual(['chrome-tok']);
        expect(n).toBe(2);
    });

    it('disconnect revokes, flushes all cached tokens and clears the persisted mode', async () => {
        const { auth, kv, identity, fetchCalls } = build({ info: CHROME });
        await auth.connect();
        await auth.disconnect();
        expect(fetchCalls.some((c) => c.url.startsWith('https://oauth2.googleapis.com/revoke'))).toBe(true);
        expect(identity.calls.clearedAll).toBe(1);
        expect(kv.data.driveAuthMode).toBeUndefined();
    });
});

describe('driveAuth facade — non-Chrome (Dia) web mode', () => {
    it('connect runs the interactive web flow, persists mode web and the account email', async () => {
        const { auth, kv, web, identity } = build({ info: DIA });
        expect(await auth.connect()).toBe(true);
        expect(web.calls.connect).toBe(1);
        expect(identity.calls.getAuthToken).toEqual([]);
        expect(kv.data.driveAuthMode).toBe('web');
        expect(await auth.getAccountEmail()).toBe('me@example.com');
    });

    it('connect failure (user cancelled) returns false and leaves nothing persisted', async () => {
        const web = fakeWebFlow({ connectError: new Error('The user did not approve access.') });
        const { auth, kv } = build({ info: DIA, web });
        expect(await auth.connect()).toBe(false);
        expect(kv.data.driveAccountEmail).toBeUndefined();
        expect(await auth.isConnected()).toBe(false);
    });

    it('isConnected means "a record exists" even when the token is expired (refresh happens in getToken)', async () => {
        const web = fakeWebFlow({ record: { accessToken: '', expiresAt: 0, email: 'me@example.com' }, validToken: null });
        const { auth } = build({ info: DIA, web });
        expect(await auth.isConnected()).toBe(true);
        expect(await auth.getToken(false)).toBeNull();
        expect(web.calls.getValid).toEqual([{ allowSilent: true }]);
    });

    it('getToken(true) in web mode runs the interactive flow and returns the token', async () => {
        const { auth, web } = build({ info: DIA });
        expect(await auth.getToken(true)).toBe('web-tok');
        expect(web.calls.connect).toBe(1);
    });

    it('authedFetch on 401 clears the web access token and retries once with a refreshed one', async () => {
        let n = 0;
        const fetchFn = async (url, init) => { n += 1; return n === 1 ? { ok: false, status: 401, text: async () => '' } : { ok: true, status: 200, _auth: init.headers.Authorization }; };
        const web = fakeWebFlow({ record: { accessToken: 'web-tok', expiresAt: 99, email: 'e' } });
        const { auth } = build({ info: DIA, web, fetchFn });
        const res = await auth.authedFetch('https://www.googleapis.com/x');
        expect(res.ok).toBe(true);
        expect(web.calls.clear).toBe(1);
        expect(n).toBe(2);
    });

    it('authedFetch throws a token-free error when not connected', async () => {
        const web = fakeWebFlow({ validToken: null });
        const { auth } = build({ info: DIA, web });
        await expect(auth.authedFetch('https://www.googleapis.com/x')).rejects.toThrow(/not connected/);
    });

    it('disconnect delegates to the web flow and clears email + mode', async () => {
        const { auth, kv, web } = build({ info: DIA });
        await auth.connect();
        await auth.disconnect();
        expect(web.calls.disconnect).toBe(1);
        expect(kv.data.driveAccountEmail).toBeUndefined();
        expect(kv.data.driveAuthMode).toBeUndefined();
        expect(await auth.isConnected()).toBe(false);
    });
});
