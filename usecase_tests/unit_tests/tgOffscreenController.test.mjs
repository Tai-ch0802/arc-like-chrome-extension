/**
 * tgOffscreenController 測試（BASE-018 TG2b）。offscreen 端 tg 控制,以 DI(post/loadAdapter)
 * 驗證,不需真 offscreen/chrome。特別覆蓋 offscreen 層的 generation guard——即
 * 「tgConnect 於 dynamic import 窗口內收到 disconnect,不留 orphan」的 race(與 tgAdapter
 * 內部的 stopped guard 是不同層)。
 */
import { createTgOffscreenController } from '../../modules/newswire/tgOffscreenController.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const cfg = { session: 's', apiId: 1, apiHash: 'h', channels: [{ username: 'BWEnews' }] };

function fakeAdapter() {
    return {
        connected: false, disconnected: false, hooks: null, cfg: null,
        connect() { this.connected = true; },
        disconnect() { this.disconnected = true; this.connected = false; },
        isAlive() { return this.connected; },
    };
}

describe('tgOffscreenController (BASE-018 TG2b)', () => {
    it('connect → loadAdapter → 建 adapter 並 connect;onRaw/onStatus 透傳為 post', async () => {
        const posts = [];
        let made = null;
        const createTgAdapter = (c, hooks) => { made = fakeAdapter(); made.hooks = hooks; made.cfg = c; return made; };
        const ctrl = createTgOffscreenController({ post: (m) => posts.push(m), loadAdapter: async () => createTgAdapter });
        await ctrl.connect(cfg);
        expect(made.connected).toBe(true);
        expect(made.cfg).toEqual(cfg);
        made.hooks.onRaw({ x: 1 });
        made.hooks.onStatus('connected');
        expect(posts).toContainEqual({ action: 'tg:raw', raw: { x: 1 } });
        expect(posts).toContainEqual({ action: 'tg:status', status: 'connected' });
    });

    it('★ disconnect during loadAdapter → generation guard 收手,不建 orphan (offscreen 層 race)', async () => {
        let releaseLoad;
        let made = null;
        const createTgAdapter = () => { made = fakeAdapter(); return made; };
        const ctrl = createTgOffscreenController({
            post: () => {},
            loadAdapter: () => new Promise((r) => { releaseLoad = () => r(createTgAdapter); }),
        });
        const p = ctrl.connect(cfg);   // 掛在 loadAdapter
        await flush();
        ctrl.disconnect();             // generation++
        releaseLoad();
        await p;
        expect(made).toBe(null);       // 未建 adapter(收手,無 orphan)
    });

    it('loadAdapter 失敗 → retrying,無 adapter', async () => {
        const posts = [];
        const ctrl = createTgOffscreenController({ post: (m) => posts.push(m), loadAdapter: async () => { throw new Error('import failed'); } });
        await ctrl.connect(cfg);
        expect(posts).toContainEqual({ action: 'tg:status', status: 'retrying' });
        expect(ctrl.ping()).toEqual({ alive: false, hasAdapter: false, status: 'retrying' });
    });

    it('ping 回 {alive, hasAdapter, status}——watchdog 據 hasAdapter 區分退避 vs adapter-less', async () => {
        const createTgAdapter = () => fakeAdapter();
        const ctrl = createTgOffscreenController({ post: () => {}, loadAdapter: async () => createTgAdapter });
        expect(ctrl.ping()).toEqual({ alive: false, hasAdapter: false, status: 'disabled' });
        await ctrl.connect(cfg);
        expect(ctrl.ping()).toEqual({ alive: true, hasAdapter: true, status: 'disabled' });
        ctrl.disconnect();
        expect(ctrl.ping()).toEqual({ alive: false, hasAdapter: false, status: 'disabled' });
    });

    /**
     * 頻道解析必須「同時只有一條連線」——MTProto 對同一 auth key 的併發連線會直接
     * 作廢 session(AUTH_KEY_DUPLICATED)。這組測試鎖住該不變式。
     */
    describe('resolveChannel 不得與常駐連線併發', () => {
        const INFO = { id: 100n, username: 'BWEnews', title: 'Chan', participantsCount: 5000 };

        it('★ 常駐連線活著 → 借用它,不另建 client', async () => {
            let clientBuilt = 0;
            const made = { ...fakeAdapter(), resolved: null };
            made.resolveChannel = async function (u) { this.resolved = u; return { username: u, title: 'Chan' }; };
            const ctrl = createTgOffscreenController({
                post: () => {},
                loadAdapter: async () => () => made,
                loadClient: async () => { clientBuilt += 1; return async () => ({}); },
            });
            await ctrl.connect(cfg);
            const info = await ctrl.resolveChannel(cfg, 'BWEnews');

            expect(made.resolved).toBe('BWEnews');   // 走既有連線
            expect(clientBuilt).toBe(0);             // ← 關鍵:完全沒有建第二條連線
            expect(info.title).toBe('Chan');
        });

        it('★ 無常駐連線(未啟用)→ 臨時建一條,用完必 disconnect', async () => {
            let disconnected = false;
            const fakeClient = {
                connected: false,
                async connect() { this.connected = true; },
                async disconnect() { disconnected = true; this.connected = false; },
                async getEntity() { return INFO; },
            };
            const ctrl = createTgOffscreenController({
                post: () => {},
                loadAdapter: async () => () => fakeAdapter(),
                loadClient: async () => async () => fakeClient,
            });
            // 未 connect → 無 adapter
            const info = await ctrl.resolveChannel(cfg, 'BWEnews');

            expect(info).toEqual({ id: '100', username: 'BWEnews', title: 'Chan', participantsCount: 5000 });
            expect(disconnected).toBe(true);         // 用完就斷,不留第二條連線
        });

        it('臨時連線在 getEntity 拋錯時仍會 disconnect(不留殘連線觸發 AUTH_KEY_DUPLICATED)', async () => {
            let disconnected = false;
            const fakeClient = {
                async connect() {},
                async disconnect() { disconnected = true; },
                async getEntity() { throw Object.assign(new Error('x'), { errorMessage: 'USERNAME_NOT_OCCUPIED' }); },
            };
            const ctrl = createTgOffscreenController({
                post: () => {},
                loadAdapter: async () => () => fakeAdapter(),
                loadClient: async () => async () => fakeClient,
            });
            await expect(ctrl.resolveChannel(cfg, 'nope')).rejects.toThrow('x');
            expect(disconnected).toBe(true);
        });
    });
});
