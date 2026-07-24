/**
 * tgProxyAdapter 測試（BASE-018 TG2b）。SW 端 proxy 以 DI(post/ensureOffscreen)驗證,
 * 不需真 chrome/offscreen。
 */
import { createTgProxyAdapter } from '../../modules/newswire/tgProxyAdapter.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const cfg = { session: 's', apiId: 1, apiHash: 'h', channels: [{ username: 'BWEnews' }] };

function setup(behavior = {}) {
    const posts = [];
    const statuses = [];
    let ensureCalls = 0;
    const deps = {
        post: (msg) => posts.push(msg),
        ensureOffscreen: async () => { ensureCalls += 1; if (behavior.ensureError) throw behavior.ensureError; },
    };
    const hooks = { onStatus: (s) => statuses.push(s) };
    return { deps, hooks, posts, statuses, getEnsureCalls: () => ensureCalls };
}

describe('tgProxyAdapter (BASE-018 TG2b)', () => {
    it('connect → ensureOffscreen + post tg:connect(cfg)', async () => {
        const { deps, hooks, posts, statuses, getEnsureCalls } = setup();
        createTgProxyAdapter(cfg, hooks, deps).connect();
        await flush();
        expect(getEnsureCalls()).toBe(1);
        expect(posts).toEqual([{ action: 'tg:connect', cfg }]);
        expect(statuses).toContain('connecting');
    });

    it('disconnect → post tg:disconnect + status disabled', async () => {
        const { deps, hooks, posts, statuses } = setup();
        const a = createTgProxyAdapter(cfg, hooks, deps);
        a.connect(); await flush();
        a.disconnect();
        expect(posts).toContainEqual({ action: 'tg:disconnect' });
        expect(statuses[statuses.length - 1]).toBe('disabled');
    });

    it('isAlive 依 offscreen 回報的 setRemoteStatus(且透傳 onStatus)', async () => {
        const { deps, hooks, statuses } = setup();
        const a = createTgProxyAdapter(cfg, hooks, deps);
        a.connect(); await flush();
        expect(a.isAlive()).toBe(false);           // connecting
        a.setRemoteStatus('connected');
        expect(a.isAlive()).toBe(true);
        expect(statuses).toContain('connected');   // 透傳給 feedManager setStatus
        a.setRemoteStatus('needs-key');
        expect(a.isAlive()).toBe(false);           // 終止態不算 alive
    });

    it('ensureOffscreen 失敗 → retrying(不 post),watchdog 再試', async () => {
        const { deps, hooks, posts, statuses } = setup({ ensureError: new Error('offscreen create failed') });
        createTgProxyAdapter(cfg, hooks, deps).connect();
        await flush();
        expect(posts).toHaveLength(0);
        expect(statuses[statuses.length - 1]).toBe('retrying');
    });

    it('ensureOffscreen 期間 disconnect → 收手,不 post tg:connect', async () => {
        let release;
        const posts = [];
        const deps = { post: (m) => posts.push(m), ensureOffscreen: () => new Promise((r) => { release = r; }) };
        const a = createTgProxyAdapter(cfg, {}, deps);
        a.connect();
        await flush();          // 掛在 ensureOffscreen
        a.disconnect();         // stopped=true
        release();
        await flush();
        expect(posts).toContainEqual({ action: 'tg:disconnect' });
        expect(posts).not.toContainEqual({ action: 'tg:connect', cfg });
    });
});
