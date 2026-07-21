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
