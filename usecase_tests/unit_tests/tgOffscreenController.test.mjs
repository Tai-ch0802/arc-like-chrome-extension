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

        /**
         * PR #212 review 抓到的殘餘窗口:只看 isAlive() 不足以判斷「有無常駐連線」。
         * tgAdapter.open() 從 createClient()(dynamic import 2.6M bundle)到
         * client.connect()(MTProto DH 交換)完成之間,isAlive() 一路 false 但連線正在
         * 建立,窗口達秒級到十秒級。而 options 登入後寫完 storage 就立刻顯示加頻道 UI
         * (不等 SW 連上),使用者「登入後連續加頻道」正好落在窗口內。
         * 修正後的不變式:**adapter 存在 ⇒ 絕不另建連線**。
         */
        it('★ adapter 連線建立中(未 alive)→ 等它就緒後借用,絕不另建 client', async () => {
            let clientBuilt = 0;
            const made = { ...fakeAdapter(), resolved: null };
            // connect() 不立刻 alive:模擬 createClient/DH 交換期間(此時 isAlive() 為 false)
            made.connect = function () { /* 仍在建立中 */ };
            made.resolveChannel = async function (u) { this.resolved = u; return { username: u }; };
            let slept = 0;
            const ctrl = createTgOffscreenController({
                post: () => {},
                loadAdapter: async () => () => made,
                loadClient: async () => { clientBuilt += 1; return async () => ({}); },
                // 第 3 次輪詢時連線才建立完成
                sleep: async () => { slept += 1; if (slept === 3) made.connected = true; },
            });
            await ctrl.connect(cfg);
            const info = await ctrl.resolveChannel(cfg, 'BWEnews');

            expect(info.username).toBe('BWEnews');
            expect(made.resolved).toBe('BWEnews');   // 等到就緒後走既有連線
            expect(clientBuilt).toBe(0);             // ← 關鍵:窗口內也沒有建第二條連線
        });

        it('★ 等到逾時仍未就緒 → 報 TG_NOT_READY,不 fallback 成臨時連線(逾時只代表還在連)', async () => {
            let clientBuilt = 0;
            const made = { ...fakeAdapter(), connect() { /* 永遠連不上 */ } };
            const ctrl = createTgOffscreenController({
                post: () => {},
                loadAdapter: async () => () => made,
                loadClient: async () => { clientBuilt += 1; return async () => ({}); },
                sleep: async () => {},
            });
            await ctrl.connect(cfg);

            await expect(ctrl.resolveChannel(cfg, 'BWEnews')).rejects.toThrow('TG_NOT_READY');
            expect(clientBuilt).toBe(0);             // fallback 就是製造併發,故不可有
        });

        it('adapter 處於終止態(session 失效/憑證錯)→ 立刻報錯,不白等到逾時', async () => {
            let slept = 0;
            const made = { ...fakeAdapter(), connect() {}, isFailed: () => true };
            const ctrl = createTgOffscreenController({
                post: () => {},
                loadAdapter: async () => () => made,
                loadClient: async () => async () => ({}),
                sleep: async () => { slept += 1; },
            });
            await ctrl.connect(cfg);

            await expect(ctrl.resolveChannel(cfg, 'BWEnews')).rejects.toThrow('TG_NOT_READY');
            expect(slept).toBe(0);                   // 終止態永不會 alive,不該輪詢等待
        });
    });

    /**
     * BASE-023:重建(tg:connect 於 adapter 已存在時)必須等舊 client 拆除完成才建
     * 新連線——fire-and-forget 拆除會讓新舊連線短暫以同一 auth key 併發,MTProto
     * 判為安全風險直接作廢 session(AUTH_KEY_DUPLICATED)。
     */
    describe('重建不重疊(BASE-023):舊 client 拆完才建新連線', () => {
        // 第一個 adapter 的 disconnect 回傳 pending promise(模擬 GramJS 拆線中),
        // 由測試手動 release。
        function slowTeardownFactory() {
            const made = [];
            const state = { release: null };
            const createTgAdapter = (c, hooks) => {
                const a = { ...fakeAdapter(), resolved: null, cfg: c, hooks };
                a.resolveChannel = async function (u) { this.resolved = u; return { username: u }; };
                if (made.length === 0) {
                    a.disconnect = function () {
                        this.connected = false;
                        return new Promise((r) => { state.release = () => { a.disconnected = true; r(); }; });
                    };
                }
                made.push(a);
                return a;
            };
            return { made, state, createTgAdapter };
        }

        it('★ 重建時等舊 adapter 拆除 resolve 才建新 adapter', async () => {
            const { made, state, createTgAdapter } = slowTeardownFactory();
            const ctrl = createTgOffscreenController({ post: () => {}, loadAdapter: async () => createTgAdapter });
            await ctrl.connect(cfg);
            const p = ctrl.connect(cfg);   // 觸發重建:舊 adapter 拆除中(pending)
            await flush();
            expect(made.length).toBe(1);   // ← 修正前:未等拆除即建新,此時已是 2(同 key 雙連線)
            state.release();
            await p;
            expect(made.length).toBe(2);
            expect(made[1].connected).toBe(true);
            expect(ctrl.ping().hasAdapter).toBe(true);
        });

        it('拆除等待期間 disconnect → 收手不建新 adapter(gen guard 覆蓋 teardown 窗口)', async () => {
            const { made, state, createTgAdapter } = slowTeardownFactory();
            const ctrl = createTgOffscreenController({ post: () => {}, loadAdapter: async () => createTgAdapter });
            await ctrl.connect(cfg);
            const p = ctrl.connect(cfg);   // 掛在 await teardown
            await flush();
            ctrl.disconnect();             // generation++
            state.release();
            await p;
            expect(made.length).toBe(1);   // 未建第二個 adapter
            expect(ctrl.ping().hasAdapter).toBe(false);
        });

        it('resolveChannel 落在重建拆除窗口(adapter 暫為 null)→ 等重建完成借用新 adapter,不建臨時 client', async () => {
            let clientBuilt = 0;
            const { made, state, createTgAdapter } = slowTeardownFactory();
            const ctrl = createTgOffscreenController({
                post: () => {},
                loadAdapter: async () => createTgAdapter,
                loadClient: async () => { clientBuilt += 1; return async () => ({}); },
            });
            await ctrl.connect(cfg);
            const rebuild = ctrl.connect(cfg);                       // 舊 adapter 拆除中
            await flush();
            const resolving = ctrl.resolveChannel(cfg, 'BWEnews');   // 窗口內:controller 的 adapter === null
            state.release();
            await rebuild;
            const info = await resolving;
            expect(clientBuilt).toBe(0);   // 窗口內也不得另建連線(臨時 client 會與垂死連線併發)
            expect(info.username).toBe('BWEnews');
            expect(made[1].resolved).toBe('BWEnews');
        });
    });
});
