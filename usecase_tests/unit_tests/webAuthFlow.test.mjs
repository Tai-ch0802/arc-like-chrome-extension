// Unit tests for modules/sync/webAuthFlow.js (ISSUE-257 WP2). All effects are faked.
import {
    GOOGLE_AUTH_ENDPOINT,
    GOOGLE_REVOKE_ENDPOINT,
    GOOGLE_USERINFO_ENDPOINT,
    WEB_AUTH_STORAGE_KEY,
    buildAuthUrl,
    parseRedirect,
    createWebAuthFlow
} from '../../modules/sync/webAuthFlow.js';

const ORIGIN = 'https://abc.chromiumapp.org';
const REDIRECT = `${ORIGIN}/`;
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/userinfo.email'];

describe('constants', () => {
    test('endpoints and key', () => {
        expect(GOOGLE_AUTH_ENDPOINT).toBe('https://accounts.google.com/o/oauth2/v2/auth');
        expect(GOOGLE_REVOKE_ENDPOINT).toBe('https://oauth2.googleapis.com/revoke');
        expect(GOOGLE_USERINFO_ENDPOINT).toBe('https://www.googleapis.com/oauth2/v3/userinfo');
        expect(WEB_AUTH_STORAGE_KEY).toBe('driveWebAuth');
    });
});

describe('buildAuthUrl', () => {
    const base = { clientId: 'cid', redirectUri: REDIRECT, scopes: SCOPES, state: 'st' };

    test('base params without prompt/login_hint', () => {
        const u = new URL(buildAuthUrl(base));
        expect(u.origin + u.pathname).toBe(GOOGLE_AUTH_ENDPOINT);
        const p = u.searchParams;
        expect(p.get('client_id')).toBe('cid');
        expect(p.get('redirect_uri')).toBe(REDIRECT);
        expect(p.get('response_type')).toBe('token');
        expect(p.get('scope')).toBe(SCOPES.join(' '));
        expect(p.get('state')).toBe('st');
        expect(p.get('include_granted_scopes')).toBe('true');
        expect(p.has('prompt')).toBe(false);
        expect(p.has('login_hint')).toBe(false);
    });

    test('throws when state missing or empty', () => {
        expect(() => buildAuthUrl({ ...base, state: '' })).toThrow();
        expect(() => buildAuthUrl({ ...base, state: undefined })).toThrow();
    });

    test('empty loginHint omitted', () => {
        expect(new URL(buildAuthUrl({ ...base, loginHint: '' })).searchParams.has('login_hint')).toBe(false);
    });

    test('with prompt and loginHint', () => {
        const p = new URL(buildAuthUrl({ ...base, prompt: 'none', loginHint: 'a@b.c' })).searchParams;
        expect(p.get('prompt')).toBe('none');
        expect(p.get('login_hint')).toBe('a@b.c');
    });
});

describe('parseRedirect', () => {
    const opts = { expectedState: 'st', redirectOrigin: ORIGIN };

    test('success from fragment', () => {
        expect(parseRedirect(`${REDIRECT}#access_token=tok&token_type=Bearer&expires_in=3599&state=st`, opts))
            .toEqual({ accessToken: 'tok', expiresIn: 3599 });
    });

    test('tolerates #/ fragment prefix', () => {
        expect(parseRedirect(`${REDIRECT}#/access_token=tok&expires_in=10&state=st`, opts))
            .toEqual({ accessToken: 'tok', expiresIn: 10 });
    });

    test('token only in query string is rejected', () => {
        expect(() => parseRedirect(`${REDIRECT}?access_token=tok&expires_in=100&state=st`, opts))
            .toThrow('web-auth: no access_token in fragment');
    });

    test('error in query string is detected', () => {
        expect(() => parseRedirect(`${REDIRECT}?error=access_denied`, opts))
            .toThrow(/^web-auth:.*access_denied/);
    });

    test('expires_in: absent defaults to 3600', () => {
        expect(parseRedirect(`${REDIRECT}#access_token=t&state=st`, opts).expiresIn).toBe(3600);
    });

    test.each([['0'], ['-5'], ['abc'], ['']])('expires_in=%p present but invalid -> 0 (already expired)', (v) => {
        expect(parseRedirect(`${REDIRECT}#access_token=t&expires_in=${v}&state=st`, opts).expiresIn).toBe(0);
    });

    test('expires_in capped at 86400', () => {
        expect(parseRedirect(`${REDIRECT}#access_token=t&expires_in=1e12&state=st`, opts).expiresIn).toBe(86400);
    });

    test('wrong origin', () => {
        expect(() => parseRedirect('https://evil.example/#access_token=t&state=st', opts))
            .toThrow(/^web-auth:/);
    });

    test('error param includes code', () => {
        expect(() => parseRedirect(`${REDIRECT}#error=access_denied&state=st`, opts))
            .toThrow(/^web-auth:.*access_denied/);
    });

    test('state missing / mismatched', () => {
        expect(() => parseRedirect(`${REDIRECT}#access_token=t`, opts)).toThrow(/^web-auth:/);
        expect(() => parseRedirect(`${REDIRECT}#access_token=t&state=other`, opts)).toThrow(/^web-auth:/);
    });

    test('access_token missing', () => {
        expect(() => parseRedirect(`${REDIRECT}#state=st&expires_in=5`, opts)).toThrow(/^web-auth:/);
    });

    test('error message never contains the token', () => {
        try {
            parseRedirect(`${REDIRECT}#access_token=SECRET&state=other`, opts);
        } catch (e) {
            expect(e.message).not.toContain('SECRET');
        }
    });
});

function setup(overrides = {}) {
    const store = new Map();
    let t = 1_000_000;
    const calls = { launch: [], fetch: [] };
    let lastState = '';
    const deps = {
        identity: {
            getRedirectURL: () => REDIRECT,
            launchWebAuthFlow: jest.fn(async ({ url, interactive }) => {
                calls.launch.push({ url, interactive });
                lastState = new URL(url).searchParams.get('state');
                return `${REDIRECT}#access_token=tok${calls.launch.length}&expires_in=3600&state=${lastState}`;
            })
        },
        storage: {
            get: async (k) => store.get(k),
            set: async (k, v) => { store.set(k, v); },
            remove: async (k) => { store.delete(k); }
        },
        now: () => t,
        randomState: () => 'rnd',
        fetchFn: jest.fn(async (url, init) => {
            calls.fetch.push({ url, init });
            if (String(url).startsWith(GOOGLE_USERINFO_ENDPOINT)) {
                return { ok: true, status: 200, json: async () => ({ email: 'u@x.com' }), text: async () => '' };
            }
            return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
        }),
        clientId: 'cid',
        scopes: SCOPES,
        ...overrides
    };
    return { flow: createWebAuthFlow(deps), deps, store, calls, advance: (ms) => { t += ms; }, now: () => t };
}

const rec = (store) => store.get(WEB_AUTH_STORAGE_KEY);
const param = (url, k) => new URL(url).searchParams.get(k);

describe('connectInteractive', () => {
    test('happy path stores record, fetches email, no loginHint on first connect', async () => {
        const { flow, store, calls, now } = setup();
        const r = await flow.connectInteractive();
        expect(r).toEqual({ accessToken: 'tok1', expiresAt: now() + 3600 * 1000 - 60 * 1000, email: 'u@x.com' });
        expect(rec(store)).toEqual(r);
        expect(calls.launch[0].interactive).toBe(true);
        expect(param(calls.launch[0].url, 'prompt')).toBe('consent');
        expect(param(calls.launch[0].url, 'login_hint')).toBeNull();
        expect(param(calls.launch[0].url, 'state')).toBe('rnd');
        const ui = calls.fetch.find((c) => c.url.startsWith(GOOGLE_USERINFO_ENDPOINT));
        expect(ui.init.headers.Authorization).toBe('Bearer tok1');
        expect(await flow.hasRecord()).toBe(true);
        expect(await flow.getEmail()).toBe('u@x.com');
    });

    test('uses stored email as loginHint on reconnect', async () => {
        const { flow, calls } = setup();
        await flow.connectInteractive();
        await flow.connectInteractive();
        expect(param(calls.launch[1].url, 'login_hint')).toBe('u@x.com');
    });

    test('failing userinfo fetch still succeeds with empty email', async () => {
        const { flow, store } = setup({ fetchFn: jest.fn(async () => { throw new Error('net'); }) });
        const r = await flow.connectInteractive();
        expect(r.email).toBe('');
        expect(rec(store).email).toBe('');
        expect(rec(store).accessToken).toBe('tok1');
    });

    test('non-ok userinfo response yields empty email', async () => {
        const { flow } = setup({ fetchFn: jest.fn(async () => ({ ok: false, status: 403, json: async () => ({}), text: async () => '' })) });
        expect((await flow.connectInteractive()).email).toBe('');
    });

    test('rejects when launch rejects and stores nothing', async () => {
        const s = setup();
        s.deps.identity.launchWebAuthFlow.mockRejectedValueOnce(new Error('The user did not approve access.'));
        await expect(s.flow.connectInteractive()).rejects.toThrow('did not approve');
        expect(rec(s.store)).toBeUndefined();
        expect(s.store.size).toBe(0);
    });
});

describe('getValidToken', () => {
    test('no record -> null, hasRecord false, no launch', async () => {
        const { flow, calls } = setup();
        expect(await flow.getValidToken()).toBeNull();
        expect(await flow.hasRecord()).toBe(false);
        expect(await flow.getEmail()).toBe('');
        expect(calls.launch).toHaveLength(0);
    });

    test('unexpired token returned without launching', async () => {
        const { flow, calls } = setup();
        await flow.connectInteractive();
        calls.launch.length = 0;
        expect(await flow.getValidToken()).toBe('tok1');
        expect(calls.launch).toHaveLength(0);
    });

    test('expired -> silent refresh with interactive:false, prompt=none, login_hint', async () => {
        const { flow, calls, store, advance } = setup();
        await flow.connectInteractive();
        advance(3600 * 1000);
        expect(await flow.getValidToken()).toBe('tok2');
        const l = calls.launch[1];
        expect(l.interactive).toBe(false);
        expect(param(l.url, 'prompt')).toBe('none');
        expect(param(l.url, 'login_hint')).toBe('u@x.com');
        expect(rec(store).accessToken).toBe('tok2');
        expect(rec(store).email).toBe('u@x.com');
        expect(rec(store).expiresAt).toBe(1_000_000 + 3600 * 1000 + 3600 * 1000 - 60 * 1000);
    });

    test('silent failure -> null and silentTriedAt set; throttled within interval; retried after', async () => {
        const { flow, deps, calls, store, advance, now } = setup();
        await flow.connectInteractive();
        advance(3600 * 1000);
        deps.identity.launchWebAuthFlow.mockRejectedValue(new Error('User interaction required'));
        const before = calls.launch.length;
        expect(await flow.getValidToken()).toBeNull();
        expect(deps.identity.launchWebAuthFlow).toHaveBeenCalledTimes(before + 1);
        expect(rec(store).silentTriedAt).toBe(now());
        advance(1000);
        expect(await flow.getValidToken()).toBeNull();
        expect(deps.identity.launchWebAuthFlow).toHaveBeenCalledTimes(before + 1);
        advance(5 * 60 * 1000);
        expect(await flow.getValidToken()).toBeNull();
        expect(deps.identity.launchWebAuthFlow).toHaveBeenCalledTimes(before + 2);
    });

    test('allowSilent:false never launches', async () => {
        const { flow, deps, advance } = setup();
        await flow.connectInteractive();
        advance(3600 * 1000);
        const n = deps.identity.launchWebAuthFlow.mock.calls.length;
        expect(await flow.getValidToken({ allowSilent: false })).toBeNull();
        expect(deps.identity.launchWebAuthFlow).toHaveBeenCalledTimes(n);
    });

    test('clearAccessToken keeps record and forces refresh', async () => {
        const { flow, store, calls } = setup();
        await flow.connectInteractive();
        await flow.clearAccessToken();
        expect(rec(store)).toMatchObject({ accessToken: '', expiresAt: 0, email: 'u@x.com' });
        expect(await flow.hasRecord()).toBe(true);
        expect(await flow.getValidToken()).toBe('tok2');
        expect(calls.launch[1].interactive).toBe(false);
    });
});

describe('getValidToken concurrency and races', () => {
    function deferredLaunch(s) {
        let resolve;
        s.deps.identity.launchWebAuthFlow.mockImplementation(({ url }) => new Promise((r) => {
            const st = new URL(url).searchParams.get('state');
            resolve = () => r(`${REDIRECT}#access_token=fresh&expires_in=3600&state=${st}`);
        }));
        return () => resolve();
    }

    test('concurrent expired calls share one launch', async () => {
        const s = setup();
        await s.flow.connectInteractive();
        s.advance(3600 * 1000);
        const release = deferredLaunch(s);
        const n = s.deps.identity.launchWebAuthFlow.mock.calls.length;
        const a = s.flow.getValidToken();
        const b = s.flow.getValidToken();
        await new Promise((r) => setTimeout(r, 0));
        release();
        expect(await Promise.all([a, b])).toEqual(['fresh', 'fresh']);
        expect(s.deps.identity.launchWebAuthFlow).toHaveBeenCalledTimes(n + 1);
    });

    test('disconnect during refresh: refreshed token is not written back', async () => {
        const s = setup();
        await s.flow.connectInteractive();
        s.advance(3600 * 1000);
        const release = deferredLaunch(s);
        const p = s.flow.getValidToken();
        await new Promise((r) => setTimeout(r, 0));
        await s.flow.disconnect();
        release();
        expect(await p).toBeNull();
        expect(s.store.has(WEB_AUTH_STORAGE_KEY)).toBe(false);
    });

    test('clock going backwards does not block the silent attempt', async () => {
        const s = setup();
        await s.flow.connectInteractive();
        s.advance(3600 * 1000);
        s.deps.identity.launchWebAuthFlow.mockRejectedValueOnce(new Error('User interaction required'));
        await s.flow.getValidToken();
        s.store.set(WEB_AUTH_STORAGE_KEY, { ...rec(s.store), silentTriedAt: s.now() + 10 * 60 * 1000 });
        expect(await s.flow.getValidToken()).toBe('tok2');
    });
});

describe('connectInteractive expiry handling', () => {
    test('expires_in=0 yields an immediately expired record', async () => {
        const s = setup();
        s.deps.identity.launchWebAuthFlow.mockImplementation(async ({ url }) =>
            `${REDIRECT}#access_token=z&expires_in=0&state=${new URL(url).searchParams.get('state')}`);
        const r = await s.flow.connectInteractive();
        expect(r.expiresAt).toBe(s.now());
    });
});

describe('disconnect', () => {
    test('posts revoke and removes record', async () => {
        const { flow, store, calls } = setup();
        await flow.connectInteractive();
        await flow.disconnect();
        const rv = calls.fetch.find((c) => c.url.startsWith(GOOGLE_REVOKE_ENDPOINT));
        expect(rv.url).toBe(GOOGLE_REVOKE_ENDPOINT);
        expect(rv.url).not.toContain('tok1');
        expect(rv.init.method).toBe('POST');
        expect(rv.init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        expect(rv.init.body).toBe('token=tok1');
        expect(store.has(WEB_AUTH_STORAGE_KEY)).toBe(false);
        expect(await flow.hasRecord()).toBe(false);
    });

    test('revoke failure is ignored and record still removed', async () => {
        const s = setup();
        await s.flow.connectInteractive();
        s.deps.fetchFn.mockRejectedValue(new Error('net'));
        await expect(s.flow.disconnect()).resolves.toBeUndefined();
        expect(s.store.has(WEB_AUTH_STORAGE_KEY)).toBe(false);
    });

    test('no token -> no revoke call, still removes', async () => {
        const { flow, calls, store } = setup();
        await flow.connectInteractive();
        await flow.clearAccessToken();
        calls.fetch.length = 0;
        await flow.disconnect();
        expect(calls.fetch).toHaveLength(0);
        expect(store.has(WEB_AUTH_STORAGE_KEY)).toBe(false);
    });
});
