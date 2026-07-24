/**
 * tgLoginController 測試（BASE-018 TG2c）。以 fake GramJS client(DI loadGramJS)驗證
 * 登入/登出/頻道解析,不需真 Telegram/網路。真登入列 TG3 手動矩陣。
 */
import { createTgLoginController } from '../../modules/newswire/tgLoginController.js';

function fakeGramJS(behavior = {}) {
    const calls = { started: null, loggedOut: false, disconnected: false, gotEntity: null, clientOptions: null };
    class FakeStringSession {
        constructor(s) { this.s = s || ''; }
        save() { return behavior.savedSession || 'SESSION_STRING'; }
    }
    class FakePromisedWebSockets {}
    FakePromisedWebSockets.isWebSocket = true;
    class FakeTelegramClient {
        constructor(session, apiId, apiHash, options) { this.session = session; calls.clientOptions = options; }
        async start(params) {
            calls.started = params;
            // 模擬 GramJS auth 迴圈:callback 回 null(取消)→ onError;onError 回 truthy 才中止(拋)。
            const code = params.phoneCode ? await params.phoneCode() : 'x';
            if (code == null || code === '') {
                if (await params.onError(new Error('Code is empty'))) throw new Error('AUTH_USER_CANCEL');
            }
            if (behavior.need2FA && params.password) {
                const pw = await params.password();
                if (pw == null || pw === '') {
                    if (await params.onError(new Error('Password is empty'))) throw new Error('AUTH_USER_CANCEL');
                }
            }
        }
        async connect() { this.connected = true; }
        async disconnect() { calls.disconnected = true; }
        async getMe() { if (behavior.getMeThrows) throw new Error('getMe fail'); return behavior.me || { firstName: 'Abla', username: 'abla' }; }
        async logOut() { calls.loggedOut = true; }
        async getEntity(u) { calls.gotEntity = u; return behavior.entity || { id: 100n, username: u, title: 'Chan', participantsCount: 5000 }; }
    }
    return { loadGramJS: async () => ({ TelegramClient: FakeTelegramClient, StringSession: FakeStringSession, PromisedWebSockets: FakePromisedWebSockets }), calls };
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

    it('★ 取消驗證碼(phoneCode 回 null)→ login 回 {cancelled}(不無限重試/不拋),仍 disconnect', async () => {
        const { loadGramJS, calls } = fakeGramJS();
        const ctrl = createTgLoginController({ loadGramJS });
        const res = await ctrl.login({ apiId: 1, apiHash: 'h', phoneNumber: '+886', phoneCode: async () => null, password: async () => 'x' });
        expect(res).toEqual({ cancelled: true });
        expect(calls.disconnected).toBe(true);
    });

    it('★ 取消 2FA(password 回 null)→ login 回 {cancelled}', async () => {
        const { loadGramJS } = fakeGramJS({ need2FA: true });
        const ctrl = createTgLoginController({ loadGramJS });
        const res = await ctrl.login({ apiId: 1, apiHash: 'h', phoneNumber: '+886', phoneCode: async () => '12345', password: async () => null });
        expect(res).toEqual({ cancelled: true });
    });

    it('真錯誤(非取消)→ 照拋,不吞成 cancelled', async () => {
        const { loadGramJS } = fakeGramJS();
        // fake start 對非空 code 不 onError;改用 loadGramJS 讓 start 拋非取消錯誤
        const ctrl = createTgLoginController({ loadGramJS: async () => {
            class SS { constructor(s) { this.s = s; } save() { return 'S'; } }
            class TC { async start() { throw new Error('PHONE_NUMBER_INVALID'); } async disconnect() {} }
            return { TelegramClient: TC, StringSession: SS };
        } });
        await expect(ctrl.login({ apiId: 1, apiHash: 'h', phoneNumber: 'x', phoneCode: async () => '1', password: async () => 'x' }))
            .rejects.toThrow('PHONE_NUMBER_INVALID');
    });

    it('★ 建 client 傳 networkSocket=PromisedWebSockets(瀏覽器 WebSocket transport)', async () => {
        // 回歸防護:不傳則 teleproto 預設 PromisedNetSockets → new net.Socket()(recipe 已
        // stub node:net)→ 真連線炸「Socket is not a constructor」。須顯式 WebSocket transport。
        const { loadGramJS, calls } = fakeGramJS();
        const ctrl = createTgLoginController({ loadGramJS });
        await ctrl.resolveChannel({ apiId: 1, apiHash: 'h', session: 'S', username: 'x' });
        expect(calls.clientOptions?.useWSS).toBe(true);
        expect(calls.clientOptions?.networkSocket).toBeDefined();
        expect(calls.clientOptions.networkSocket.isWebSocket).toBe(true);
    });
});
