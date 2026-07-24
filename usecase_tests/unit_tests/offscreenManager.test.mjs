/**
 * offscreenManager 單例 guard 測試（BASE-018 TG2b）。以 fake chrome API 驗證
 * RSS 與 tg 共用單一 offscreen document 時不會並發重複建立。
 */
import { ensureOffscreenDocument, hasOffscreenDocument } from '../../modules/offscreenManager.js';

function makeChrome({ contexts = [] } = {}) {
    const createCalls = [];
    let current = contexts;
    const chrome = {
        runtime: {
            getContexts: async () => current,
            getURL: (p) => `chrome-extension://x${p}`,
        },
        offscreen: {
            Reason: { DOM_PARSER: 'DOM_PARSER' },
            createDocument: async (opts) => { createCalls.push(opts); },
        },
    };
    return { chrome, createCalls, setContexts: (c) => { current = c; } };
}

describe('offscreenManager (BASE-018 TG2b)', () => {
    afterEach(() => { delete global.chrome; });

    it('既有 document → 不再 createDocument', async () => {
        const f = makeChrome({ contexts: [{ ctx: 1 }] });
        global.chrome = f.chrome;
        await ensureOffscreenDocument();
        expect(f.createCalls).toHaveLength(0);
    });

    it('無 document → 建立一次(reasons 含 DOM_PARSER)', async () => {
        const f = makeChrome({ contexts: [] });
        global.chrome = f.chrome;
        await ensureOffscreenDocument();
        expect(f.createCalls).toHaveLength(1);
        expect(f.createCalls[0].reasons).toContain('DOM_PARSER');
        expect(f.createCalls[0].url).toBe('/offscreen.html');
    });

    it('並發呼叫只建一次(單例 guard — RSS 與 tg 同時觸發不撞單一 document)', async () => {
        const f = makeChrome({ contexts: [] });
        let release;
        f.chrome.offscreen.createDocument = async (opts) => {
            f.createCalls.push(opts);
            await new Promise((r) => { release = r; }); // 掛起,讓並發撞上 guard
        };
        global.chrome = f.chrome;
        const p1 = ensureOffscreenDocument();
        const p2 = ensureOffscreenDocument();
        await new Promise((r) => setTimeout(r, 0)); // 讓兩者都跑過 getContexts
        release();
        await Promise.all([p1, p2]);
        expect(f.createCalls).toHaveLength(1);
    });

    it('hasOffscreenDocument 反映存在與否', async () => {
        const f = makeChrome({ contexts: [] });
        global.chrome = f.chrome;
        expect(await hasOffscreenDocument()).toBe(false);
        f.setContexts([{ ctx: 1 }]);
        expect(await hasOffscreenDocument()).toBe(true);
    });

    it('建立失敗後 guard 歸零(下次可重試,不卡死)', async () => {
        const f = makeChrome({ contexts: [] });
        let attempt = 0;
        f.chrome.offscreen.createDocument = async () => {
            attempt += 1;
            if (attempt === 1) throw new Error('transient create failure');
        };
        global.chrome = f.chrome;
        await expect(ensureOffscreenDocument()).rejects.toThrow('transient');
        // guard 已歸零 → 第二次能重試並成功
        await ensureOffscreenDocument();
        expect(attempt).toBe(2);
    });
});
