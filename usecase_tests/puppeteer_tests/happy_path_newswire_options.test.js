const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * BASE-016 N2: options「快訊」section happy path。
 *
 * 測試策略:零真實連線——啟用流程用「FinancialJuice 啟用但不填 key」驗證
 * (feedManager 判定 missingCreds → 不建連線、廣播 needs-key 狀態),
 * 金十分段/規則編輯只驗 storage 寫入(jin10 未啟用,不會連線)。
 * Tree 啟用會連真 WSS,刻意不在 CI 觸發(手動矩陣涵蓋)。
 */

describe('Newswire Options Section (BASE-016 N2)', () => {
    let browser;
    let page; // options page
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        extensionId = setup.extensionId;
        page = await browser.newPage();
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item[data-section="newswire"]', { timeout: 15000 });
        await page.click('.opt-nav__item[data-section="newswire"]');
        await page.waitForSelector('[data-newswire-source="tree"]', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('renders four source cards with key fields and guidance links', async () => {
        const cards = await page.$$eval('[data-newswire-source]', els => els.map(el => el.dataset.newswireSource));
        expect(cards).toEqual(['tree', 'fj', 'alpaca', 'jin10']);

        // key 欄位遮罩+new-password(安全慣例);Alpaca 有兩欄。
        const fjType = await page.$eval('#newswire-key-fj-apiKey', el => ({ type: el.type, ac: el.autocomplete }));
        expect(fjType).toEqual({ type: 'password', ac: 'new-password' });
        expect(await page.$('#newswire-key-alpaca-keyId')).toBeTruthy();
        expect(await page.$('#newswire-key-alpaca-secret')).toBeTruthy();

        const links = await page.$$eval('[data-newswire-source] a[target="_blank"]', els => els.map(el => el.href));
        expect(links.some(h => h.includes('treeofalpha.com'))).toBe(true);
        expect(links.some(h => h.includes('open.jin10.com'))).toBe(true);
    }, 120000);

    test('enabling FJ without a key writes config and surfaces needs-key status (no network)', async () => {
        await page.click('#newswire-enable-fj');

        // config 寫入(SW onChanged 會重建連線層)。
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.sources?.fj?.enabled === true), { timeout: 5000 });

        // SW 判定缺 key → 廣播 needs-key → 狀態徽章與行內提示更新。
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-newswire-source="fj"] .newswire-status');
            return el && el.dataset.status === 'needs-key';
        }, { timeout: 5000 });
        const noteHidden = await page.$eval('[data-newswire-source="fj"] .newswire-card-note',
            el => el.classList.contains('hidden'));
        expect(noteHidden).toBe(false);

        // 關閉後回到 disabled。
        await page.click('#newswire-enable-fj');
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-newswire-source="fj"] .newswire-status');
            return el && el.dataset.status === 'disabled';
        }, { timeout: 5000 });
    }, 120000);

    test('jin10 category multi-select persists to config (source stays disabled)', async () => {
        const futures = await page.$('[data-newswire-source="jin10"] .newswire-cats input[value="2"]');
        await futures.click();
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => (v.newswireConfig?.sources?.jin10?.categories || []).includes('2')), { timeout: 5000 });
        const enabled = await page.evaluate(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.sources?.jin10?.enabled === true));
        expect(enabled).toBe(false);
    }, 120000);

    test('keyword rules editor parses and persists comma-separated words', async () => {
        await page.$eval('#newswire-rules-p1', (el) => {
            el.value = 'CoWoS, 台積電,  , CoWoS, HBM4';
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => JSON.stringify(v.newswireConfig?.rules?.p1) === JSON.stringify(['CoWoS', '台積電', 'HBM4'])), { timeout: 5000 });
    }, 120000);

    test('key-sync opt-in toggle persists prefs.syncKeys with a timestamp (BASE-016 N3)', async () => {
        const before = await page.evaluate(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.syncKeys === true));
        expect(before).toBe(false); // default off (FR-20)

        await page.click('#newswire-sync-keys');
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.syncKeys === true
                && typeof v.newswireConfig?.prefs?.updatedAt === 'number'), { timeout: 5000 });

        await page.click('#newswire-sync-keys'); // back off
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.syncKeys === false), { timeout: 5000 });
    }, 120000);

    test('Drive guide card is shown while Drive is not connected, and jumps to Sync', async () => {
        // placeholder client_id in tests → driveAuth.isConnected() is false → card shown.
        const card = await page.$('.newswire-drive-guide');
        expect(card).toBeTruthy();
        await page.click('.newswire-drive-guide button');
        await page.waitForFunction(() => {
            const active = document.querySelector('.opt-nav__item.active');
            return active && active.dataset.section === 'sync';
        }, { timeout: 5000 });
        // 回到快訊分頁,不影響後續測試(本 describe 已無後續,仍還原以防未來新增)。
        await page.click('.opt-nav__item[data-section="newswire"]');
    }, 120000);
});
