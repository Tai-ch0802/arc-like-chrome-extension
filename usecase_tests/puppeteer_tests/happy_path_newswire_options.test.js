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

    test('renders source cards (four base + Telegram) with key fields and guidance links', async () => {
        const cards = await page.$$eval('[data-newswire-source]', els => els.map(el => el.dataset.newswireSource));
        expect(cards).toEqual(['tree', 'fj', 'alpaca', 'jin10', 'tg']); // TG2c 加 Telegram 卡片(第五源)

        // Telegram 卡片(TG2c,未登入態)存在;結構異於四源的簡單 key 卡片(有登入流程)。
        expect(await page.$('[data-newswire-source="tg"]')).toBeTruthy();

        // 卡片預設收合(BASE-019):body 隱藏、toggle aria-expanded=false;狀態徽章留在標題列。
        expect(await page.$eval('[data-newswire-source="fj"] .newswire-card-body',
            el => el.classList.contains('hidden'))).toBe(true);
        expect(await page.$eval('[data-newswire-source="fj"] .newswire-card-toggle',
            el => el.getAttribute('aria-expanded'))).toBe('false');
        expect(await page.$('[data-newswire-source="tg"] .newswire-card-toggle .newswire-status')).toBeTruthy();

        // key 欄位遮罩+new-password(安全慣例);Alpaca 有兩欄。
        const fjType = await page.$eval('#newswire-key-fj-apiKey', el => ({ type: el.type, ac: el.autocomplete }));
        expect(fjType).toEqual({ type: 'password', ac: 'new-password' });
        expect(await page.$('#newswire-key-alpaca-keyId')).toBeTruthy();
        expect(await page.$('#newswire-key-alpaca-secret')).toBeTruthy();

        // 比對 hostname 全等而非子字串:子字串比對會被 CodeQL 的
        // js/incomplete-url-substring-sanitization 標記(evil.com/treeofalpha.com
        // 之類也會通過),精確比對同時更嚴謹。
        const hosts = await page.$$eval(
            '[data-newswire-source] a[target="_blank"]',
            els => els.map(el => new URL(el.href).hostname)
        );
        expect(hosts).toContain('news.treeofalpha.com');
        expect(hosts).toContain('open.jin10.com');
    }, 120000);

    test('enabling FJ without a key writes config and surfaces needs-key status (no network)', async () => {
        // 卡片預設收合(BASE-019):先展開、等 checkbox 實際可見再點。
        await page.click('[data-newswire-source="fj"] .newswire-card-toggle');
        await page.waitForSelector('#newswire-enable-fj', { visible: true, timeout: 5000 });
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
        // 卡片預設收合(BASE-019):先展開、等分類 checkbox 實際可見再點。
        await page.click('[data-newswire-source="jin10"] .newswire-card-toggle');
        await page.waitForSelector('[data-newswire-source="jin10"] .newswire-cats input[value="2"]',
            { visible: true, timeout: 5000 });
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

    test('P0 notification toggle defaults on and persists prefs.notificationsEnabled (BASE-016 N4)', async () => {
        const on = await page.evaluate(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.notificationsEnabled !== false));
        expect(on).toBe(true); // default on
        expect(await page.$eval('#newswire-notif', el => el.checked)).toBe(true);

        await page.click('#newswire-notif');
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.notificationsEnabled === false
                && typeof v.newswireConfig?.prefs?.updatedAt === 'number'), { timeout: 5000 });

        await page.click('#newswire-notif'); // back on
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.notificationsEnabled === true), { timeout: 5000 });
    }, 120000);

    test('the notifications permission is declared in the manifest (BASE-016 N4)', async () => {
        const perms = await page.evaluate(() => chrome.runtime.getManifest().permissions);
        expect(perms).toContain('notifications');
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
        // 回到快訊分頁,不影響後續測試。
        await page.click('.opt-nav__item[data-section="newswire"]');
    }, 120000);

    // 本測試會 reload 並寫入 tg session,置於最後(自包含,不污染前面共用 page)。
    test('enabling key sync while a tg session exists requires a risk confirm; cancel reverts, confirm persists (BASE-018 TG2c, FR-04/US-3)', async () => {
        // 前置:寫入 tg session(等同已登入)+ syncKeys=false,reload 讓 renderNewswire 反映。
        // 不 enable tg source → SW 不會拿 fake session 連 Telegram。
        await page.evaluate(() => new Promise((resolve) => {
            chrome.storage.local.get({ newswireKeys: {}, newswireConfig: {} }, (r) => {
                const keys = r.newswireKeys || {};
                keys.tg = { apiId: 1, apiHash: 'h', session: 'FAKE_SESSION_FOR_TEST' };
                const cfg = r.newswireConfig || {};
                cfg.prefs = { ...(cfg.prefs || {}), syncKeys: false };
                chrome.storage.local.set({ newswireKeys: keys, newswireConfig: cfg }, resolve);
            });
        }));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.opt-nav__item[data-section="newswire"]', { timeout: 15000 });
        await page.click('.opt-nav__item[data-section="newswire"]');
        await page.waitForSelector('#newswire-sync-keys', { timeout: 15000 });
        expect(await page.$eval('#newswire-sync-keys', el => el.checked)).toBe(false);

        // 開啟 → 已有 tg session ⇒ 彈風險 confirm modal(FR-04:開啟同步前顯著告知)。
        await page.click('#newswire-sync-keys');
        await page.waitForSelector('.modal-overlay .confirm-btn', { timeout: 5000 });

        // 取消 ⇒ toggle 還原、syncKeys 不被寫成 true(揭露非阻擋,尊重使用者取消)。
        await page.click('.modal-overlay .cancel-btn');
        await page.waitForFunction(() => {
            const el = document.querySelector('#newswire-sync-keys');
            return el && el.checked === false && !document.querySelector('.modal-overlay');
        }, { timeout: 5000 });
        const afterCancel = await page.evaluate(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.syncKeys === true));
        expect(afterCancel).toBe(false);

        // 再開啟 → 確認 ⇒ syncKeys 落地 true。
        await page.click('#newswire-sync-keys');
        await page.waitForSelector('.modal-overlay .confirm-btn', { timeout: 5000 });
        await page.click('.modal-overlay .confirm-btn');
        await page.waitForFunction(() => chrome.storage.local.get('newswireConfig')
            .then(v => v.newswireConfig?.prefs?.syncKeys === true), { timeout: 5000 });
        expect(await page.$eval('#newswire-sync-keys', el => el.checked)).toBe(true);
    }, 120000);
});
