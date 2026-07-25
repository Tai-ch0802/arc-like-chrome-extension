const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * BASE-016 N1: newswire 快訊區塊 happy path。
 *
 * 測試策略:不連任何真實 WSS 來源(CI 網路依賴=flaky 來源;真連線屬
 * 手動驗證矩陣)。改走協定路徑:
 *  - SW 端 `newswire:getState` roundtrip 驗證 background 接線;
 *  - 即時渲染由「另一個 extension 頁面廣播 newswire:events」模擬 SW
 *    broadcast(chrome.runtime.sendMessage 不會回送給發送頁,由 options
 *    頁發送、sidepanel 接收);
 *  - 顯隱走 settingsBridge(newswireVisible)。
 * 管線純函式(normalizer/dedupe/rules/eventBuffer)由 unit tests 涵蓋。
 */

const now = Date.now();
const LIVE_EVENTS = [
    { id: 'tree:p2', source: 'tree', sourceId: 'p2', tsSource: now - 3000, tsIngest: now - 3000, title: 'Regular market headline', importance: 2, srcImportant: false },
    { id: 'tree:p1', source: 'tree', sourceId: 'p1', tsSource: now - 2000, tsIngest: now - 2000, title: 'TSMC quarterly results beat estimates', url: 'https://example.com/tsmc', importance: 1, srcImportant: false },
    { id: 'tree:p0', source: 'tree', sourceId: 'p0', tsSource: now - 1000, tsIngest: now - 1000, title: 'US CPI YoY 3.1% vs 3.0% est', url: 'https://example.com/cpi', importance: 0, srcImportant: false },
];

describe('Newswire Section (BASE-016 N1)', () => {
    let browser;
    let page;            // sidepanel page
    let optionsPage;     // second extension page, used to broadcast
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        await page.waitForSelector('#newswire-section', { timeout: 15000 });
        optionsPage = await browser.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await optionsPage.waitForSelector('#opt-nav', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('section renders with translated header, empty state, and hidden controls by default', async () => {
        const header = await page.$eval('#newswire-section .section-header', el => el.textContent.trim());
        expect(header.length).toBeGreaterThan(0);

        // 預設無來源啟用:空狀態顯示、暫停/已讀鈕隱藏。
        const emptyHidden = await page.$eval('#newswire-empty', el => el.classList.contains('hidden'));
        expect(emptyHidden).toBe(false);
        expect(await page.$eval('#newswire-pause-btn', el => el.classList.contains('hidden'))).toBe(true);
        expect(await page.$eval('#newswire-mark-read-btn', el => el.classList.contains('hidden'))).toBe(true);
    }, 120000);

    test('newswire:getState roundtrip reaches the SW feedManager (background wiring)', async () => {
        const state = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'newswire:getState' }));
        expect(state).toBeTruthy();
        expect(Array.isArray(state.events)).toBe(true);
        expect(state.enabledAny).toBe(false);
        expect(state.statuses).toMatchObject({ tree: 'disabled', fj: 'disabled', alpaca: 'disabled', jin10: 'disabled' });
    }, 120000);

    test('broadcast events render at the top with importance highlighting', async () => {
        await optionsPage.evaluate((events) =>
            chrome.runtime.sendMessage({ type: 'newswire:events', events }).catch(() => {}), LIVE_EVENTS);

        await page.waitForFunction(() =>
            document.querySelectorAll('#newswire-list .newswire-item').length >= 3, { timeout: 5000 });

        const rows = await page.$$eval('#newswire-list .newswire-item', els => els.map(el => ({
            id: el.dataset.eventId,
            p0: el.classList.contains('newswire-item--p0'),
            p1: el.classList.contains('newswire-item--p1'),
            link: el.classList.contains('newswire-item--link'),
            title: el.querySelector('.newswire-item__title').textContent,
            source: el.querySelector('.newswire-item__source').textContent,
        })));

        // broadcast 陣列為新→舊(LIVE_EVENTS 排列相反,renderer 以反向插入保序)。
        expect(rows.map(r => r.id)).toEqual(['tree:p2', 'tree:p1', 'tree:p0']);
        const byId = Object.fromEntries(rows.map(r => [r.id, r]));
        expect(byId['tree:p0']).toMatchObject({ p0: true, p1: false, link: true });
        expect(byId['tree:p1']).toMatchObject({ p0: false, p1: true, link: true });
        expect(byId['tree:p2']).toMatchObject({ p0: false, p1: false, link: false });
        expect(byId['tree:p0'].title).toContain('CPI');
        expect(byId['tree:p0'].source).toBe('tree');

        // 有內容後空狀態隱藏。
        expect(await page.$eval('#newswire-empty', el => el.classList.contains('hidden'))).toBe(true);
    }, 120000);

    test('a later broadcast prepends above existing rows', async () => {
        const live = {
            id: 'tree:live', source: 'tree', sourceId: 'live',
            tsSource: Date.now(), tsIngest: Date.now(),
            title: 'Breaking: fresh headline', importance: 2, srcImportant: false,
        };
        await optionsPage.evaluate((ev) =>
            chrome.runtime.sendMessage({ type: 'newswire:events', events: [ev] }).catch(() => {}), live);

        await page.waitForFunction(() => {
            const first = document.querySelector('#newswire-list .newswire-item');
            return first && first.dataset.eventId === 'tree:live';
        }, { timeout: 5000 });
    }, 120000);

    const broadcast = (events) => optionsPage.evaluate((evs) =>
        chrome.runtime.sendMessage({ type: 'newswire:events', events: evs }).catch(() => {}), events);

    // 在單一 evaluate 內設搜尋 + 等 debounce + 讀結果,回傳指定 id 的 hidden 狀態。
    // 一步到位避開 puppeteer 跨呼叫的時序 flakiness(page.type 更會在快訊列表有
    // 內容時卡住其元素 stability 檢查——工具偽陽性,真實鍵盤不受影響)。
    const searchAndRead = (query, ids) => page.evaluate(async (q, wantIds) => {
        const box = document.getElementById('search-box');
        box.value = q;
        box.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 600)); // 過 300ms debounce
        const out = {};
        for (const id of wantIds) {
            const el = document.querySelector(`#newswire-list [data-event-id="${id}"]`);
            out[id] = el ? (el.classList.contains('hidden') ? 'hidden' : 'visible') : 'absent';
        }
        return out;
    }, query, ids);

    test('the search bar filters newswire items; clearing restores them (BASE-017)', async () => {
        // 自足:不依賴前面測試的列表狀態,自己注入兩則可辨識事件。
        const t = Date.now();
        await broadcast([
            { id: 'tree:sf-a', source: 'tree', sourceId: 'sf-a', tsSource: t - 200, tsIngest: t - 200, title: 'Search fixture CPI print', url: 'https://example.com/a', importance: 0 },
            { id: 'tree:sf-b', source: 'tree', sourceId: 'sf-b', tsSource: t - 100, tsIngest: t - 100, title: 'Search fixture unrelated headline', importance: 2 },
        ]);
        await page.waitForFunction(() =>
            document.querySelector('#newswire-list [data-event-id="tree:sf-a"]')
            && document.querySelector('#newswire-list [data-event-id="tree:sf-b"]'), { timeout: 5000 });

        // 含 CPI 的 sf-a 可見、sf-b 隱藏。
        expect(await searchAndRead('CPI', ['tree:sf-a', 'tree:sf-b']))
            .toEqual({ 'tree:sf-a': 'visible', 'tree:sf-b': 'hidden' });

        // 清除搜尋 → 兩則都復原可見。
        expect(await searchAndRead('', ['tree:sf-a', 'tree:sf-b']))
            .toEqual({ 'tree:sf-a': 'visible', 'tree:sf-b': 'visible' });
    }, 120000);

    test('the list is height-capped with internal scrolling (BASE-017)', async () => {
        const style = await page.$eval('#newswire-list', el => {
            const cs = getComputedStyle(el);
            return { overflowY: cs.overflowY, maxHeight: cs.maxHeight };
        });
        expect(style.overflowY).toBe('auto');
        expect(style.maxHeight).not.toBe('none');
        expect(parseInt(style.maxHeight, 10)).toBeGreaterThan(0);
    }, 120000);

    test('a tg:raw message flows the real pipeline into a clickable row; clicking grays it read and persists (BASE-018/020)', async () => {
        // 走真管線(不連真 Telegram):tg:raw → SW parseTgMessage(組 t.me url)→ buffer
        // → 廣播渲染。端到端鎖「頻道 username → 可點 url」與「點擊 → 已讀落地」。
        //
        // 先 getState 一次喚醒 SW 並等 init 完成再發 tg:raw:SW 若在 idle 掛起中被
        // tg:raw 喚醒,喚醒瞬間發出的 newswire:events 廣播會與頁面 port 建立 race 而
        // 偶發丟失(診斷實錄:SW buffer 有事件、sidepanel 沒收到)。真實場景由「開面板
        // 時 getState 回填」兜底,測試則以 pre-wake 消除對喚醒時序的依賴。
        // msgId 每 attempt 唯一:固定 id 會在 retry 時被 SW dedupe 吸收,retry 必死;
        // 唯一 id 讓 jest retry 能吸收殘餘的 SW 生命週期 race(~5%,無法在測試中根絕)。
        const msgId = Date.now() % 100000000;
        const evId = `tg:999:${msgId}`;
        await optionsPage.evaluate(() => chrome.runtime.sendMessage({ action: 'newswire:getState' }).catch(() => {}));
        await optionsPage.evaluate((mid) => chrome.runtime.sendMessage({
            action: 'tg:raw',
            raw: {
                message: { id: mid, message: 'TG read-state fixture headline', date: Math.floor(Date.now() / 1000) },
                channel: { id: '999', username: 'testchan', title: 'Test Channel' },
            },
        }).catch(() => {}), msgId);

        // row 出現且可點(newswire-item--link=有 url;url 由 SW 端組出 https://t.me/testchan/<msgId>)。
        await page.waitForFunction((id) => {
            const el = document.querySelector(`#newswire-list [data-event-id="${id}"]`);
            return el && el.classList.contains('newswire-item--link') && !el.classList.contains('is-read');
        }, { timeout: 5000 }, evId);

        // 點擊:stub 掉 tabs.create(不真開 t.me 分頁,CI 不外連),驗反灰與落地。
        await page.evaluate((id) => {
            chrome.tabs.create = () => Promise.resolve({});
            document.querySelector(`#newswire-list [data-event-id="${id}"]`).click();
        }, evId);
        expect(await page.$eval(`#newswire-list [data-event-id="${evId}"]`,
            el => el.classList.contains('is-read'))).toBe(true);

        // SW markRead → ring buffer read:true → 立即 flush 落地 storage(SW debounce
        // timer 會隨 SW 掛起蒸發,故 markRead 不等 debounce;此處同時是該行為的回歸鎖)。
        await page.waitForFunction((id) => chrome.storage.local.get('newswireEvents')
            .then(v => (v.newswireEvents?.events || []).find(e => e.id === id)?.read === true), { timeout: 8000 }, evId);
    }, 120000);

    test('the clear button empties the feed via the SW round-trip (BASE-017)', async () => {
        // 自足:先確保列表有內容(清空搜尋 + 注入一則),再驗清除。
        await searchAndRead('', []);
        const t = Date.now();
        await broadcast([{ id: 'tree:clr', source: 'tree', sourceId: 'clr', tsSource: t, tsIngest: t, title: 'Clear fixture headline', importance: 2 }]);
        await page.waitForFunction(() =>
            document.querySelector('#newswire-list [data-event-id="tree:clr"]')
            && !document.getElementById('newswire-clear-btn').classList.contains('hidden'), { timeout: 5000 });

        // DOM click(繞開 puppeteer 互動層 stability 檢查,同上)。
        await page.$eval('#newswire-clear-btn', el => el.click());
        // SW 處理 newswire:clear → 廣播 newswire:cleared → 本地清空。
        await page.waitForFunction(() =>
            document.querySelectorAll('#newswire-list .newswire-item').length === 0, { timeout: 5000 });

        // buffer 已落地為空、清除鈕隨之隱藏。
        const stored = await page.evaluate(() => chrome.storage.local.get('newswireEvents')
            .then(v => v.newswireEvents?.events ?? []));
        expect(stored).toEqual([]);
        expect(await page.$eval('#newswire-clear-btn', el => el.classList.contains('hidden'))).toBe(true);
    }, 120000);

    test('newswireVisible toggle hides/shows the section via the settings bridge', async () => {
        await page.evaluate(() => chrome.storage.sync.set({ newswireVisible: false }));
        await page.waitForFunction(() =>
            document.getElementById('newswire-section').style.display === 'none', { timeout: 5000 });

        await page.evaluate(() => chrome.storage.sync.set({ newswireVisible: true }));
        await page.waitForFunction(() =>
            document.getElementById('newswire-section').style.display !== 'none', { timeout: 5000 });
        await page.evaluate(() => chrome.storage.sync.remove('newswireVisible'));
    }, 120000);
});
