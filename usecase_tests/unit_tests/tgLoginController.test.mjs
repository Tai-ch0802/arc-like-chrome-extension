/**
 * tgLoginController 測試（BASE-018 TG2c）。以 fake GramJS client(DI loadGramJS)驗證
 * 登入/登出/頻道解析,不需真 Telegram/網路。真登入列 TG3 手動矩陣。
 */
import { createTgLoginController } from '../../modules/newswire/tgLoginController.js';

function fakeGramJS(behavior = {}) {
    const calls = { started: null, loggedOut: false, disconnected: false, gotEntity: null };
    class FakeStringSession {
        constructor(s) { this.s = s || ''; }
        save() { return behavior.savedSession || 'SESSION_STRING'; }
    }
    class FakeTelegramClient {
        constructor(session) { this.session = session; }
        async start(params) {
            calls.started = params;
            if (params.phoneCode) await params.phoneCode();           // 模擬互動:要驗證碼
            if (behavior.need2FA && params.password) await params.password(); // 要 2FA
        }
        async connect() { this.connected = true; }
        async disconnect() { calls.disconnected = true; }
        async getMe() { if (behavior.getMeThrows) throw new Error('getMe fail'); return behavior.me || { firstName: 'Abla', username: 'abla' }; }
        async logOut() { calls.loggedOut = true; }
        async getEntity(u) { calls.gotEntity = u; return behavior.entity || { id: 100n, username: u, title: 'Chan', participantsCount: 5000 }; }
    }
    return { loadGramJS: async () => ({ TelegramClient: FakeTelegramClient, StringSession: FakeStringSession }), calls };
}

describe('tgLoginController (BASE-018 TG2c)', () => {
    it('login → start 呼叫 phoneCode/password callback → session.save + getMe;必 disconnect', async () => {
        const { loadGramJS, calls } = fakeGramJS({ need2FA: true });
        const ctrl = createTgLoginController({ loadGramJS });
        let codeAsked = false; let pwAsked = false;
        const res = await ctrl.login({
            apiId: 1, apiHash: 'h', phoneNumber: '+886900000000',
            phoneCode: async () => { codeAsked = true; return '12345'; },
            password: async () => { pwAsked = true; return '2fa'; },
        });
        expect(codeAsked).toBe(true);
        expect(pwAsked).toBe(true);
        expect(res.session).toBe('SESSION_STRING');
        expect(res.me).toEqual({ firstName: 'Abla', username: 'abla' });
        expect(calls.disconnected).toBe(true);
    });

    it('login 無 2FA → 不呼叫 password callback', async () => {
        const { loadGramJS } = fakeGramJS({ need2FA: false });
        const ctrl = createTgLoginController({ loadGramJS });
        let pwAsked = false;
        await ctrl.login({ apiId: 1, apiHash: 'h', phoneNumber: '+886', phoneCode: async () => '1', password: async () => { pwAsked = true; return 'x'; } });
        expect(pwAsked).toBe(false);
    });

    it('login getMe 失敗仍回 session(me 空)', async () => {
        const { loadGramJS } = fakeGramJS({ getMeThrows: true });
        const ctrl = createTgLoginController({ loadGramJS });
        const res = await ctrl.login({ apiId: 1, apiHash: 'h', phoneNumber: '+886', phoneCode: async () => '1', password: async () => 'x' });
        expect(res.session).toBe('SESSION_STRING');
        expect(res.me).toEqual({});
    });

    it('logout → client.logOut(遠端撤銷)+ disconnect', async () => {
        const { loadGramJS, calls } = fakeGramJS();
        const ctrl = createTgLoginController({ loadGramJS });
        await ctrl.logout({ apiId: 1, apiHash: 'h', session: 'SESS' });
        expect(calls.loggedOut).toBe(true);
        expect(calls.disconnected).toBe(true);
    });

    it('logout 無 session → no-op(不建 client)', async () => {
        const { loadGramJS, calls } = fakeGramJS();
        const ctrl = createTgLoginController({ loadGramJS });
        await ctrl.logout({ apiId: 1, apiHash: 'h', session: '' });
        expect(calls.loggedOut).toBe(false);
        expect(calls.disconnected).toBe(false);
    });

    it('resolveChannel → getEntity 回頻道名/username/訂閱數(防仿冒確認)', async () => {
        const { loadGramJS, calls } = fakeGramJS();
        const ctrl = createTgLoginController({ loadGramJS });
        const r = await ctrl.resolveChannel({ apiId: 1, apiHash: 'h', session: 'SESS', username: 'BWEnews' });
        expect(calls.gotEntity).toBe('BWEnews');
        expect(r).toEqual({ id: '100', username: 'BWEnews', title: 'Chan', participantsCount: 5000 });
        expect(calls.disconnected).toBe(true);
    });
});
