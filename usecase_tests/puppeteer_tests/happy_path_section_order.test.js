const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * BASE-015: sidebar section order (+ BASE-016 N1 加入第五區塊 newswire)。
 *
 * 排序偏好存 chrome.storage.sync.sectionOrder;options 外觀頁的拖曳清單只寫
 * storage,sidepanel 經 settingsBridge 的 sectionOrderChanged 事件以 appendChild
 * 重排 .panel-section wrapper。
 *
 * 測試策略:storage-driven — 直接寫 sectionOrder 並斷言 DOM 順序。
 * 不用 puppeteer 模擬 HTML5 拖曳(既知 flaky 來源);拖曳互動由
 * mergeSectionOrder 的 unit tests 與手動驗證涵蓋。
 */

const DEFAULT_ORDER = ['tabs', 'otherWindows', 'readingList', 'bookmarks', 'newswire'];

const readOrder = (page) => page.$$eval(
    '#content-container > [data-section-id]',
    els => els.map(el => el.dataset.sectionId)
);

const waitForOrder = (page, expected) => page.waitForFunction((want) => {
    const ids = [...document.querySelectorAll('#content-container > [data-section-id]')]
        .map(el => el.dataset.sectionId);
    return ids.join(',') === want;
}, { timeout: 5000 }, expected.join(','));

describe('Sidebar Section Order (BASE-015)', () => {
    let browser;
    let page;            // sidepanel page
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('default order (no stored preference) matches the built-in layout', async () => {
        const ids = await readOrder(page);
        expect(ids).toEqual(DEFAULT_ORDER);
    }, 120000);

    test('writing sectionOrder reorders the live sidepanel via the storage bridge', async () => {
        await page.evaluate(() => chrome.storage.sync.set({
            sectionOrder: ['bookmarks', 'readingList', 'tabs', 'otherWindows', 'newswire'],
        }));
        await waitForOrder(page, ['bookmarks', 'readingList', 'tabs', 'otherWindows', 'newswire']);

        // Section ids the panel doesn't have (another device / future feature)
        // are tolerated — ignored for layout, and NOT rewritten back to storage.
        await page.evaluate(() => chrome.storage.sync.set({
            sectionOrder: ['ghostSection', 'newswire', 'readingList', 'bookmarks', 'tabs', 'otherWindows'],
        }));
        await waitForOrder(page, ['newswire', 'readingList', 'bookmarks', 'tabs', 'otherWindows']);

        const stored = await page.evaluate(() =>
            chrome.storage.sync.get('sectionOrder').then(v => v.sectionOrder));
        expect(stored).toEqual(['ghostSection', 'newswire', 'readingList', 'bookmarks', 'tabs', 'otherWindows']);

        await page.evaluate(() => chrome.storage.sync.remove('sectionOrder'));
        await waitForOrder(page, DEFAULT_ORDER);
    }, 120000);

    test('a pre-newswire preference (4 ids) appends the new section at the end', async () => {
        await page.evaluate(() => chrome.storage.sync.set({
            sectionOrder: ['bookmarks', 'tabs', 'otherWindows', 'readingList'],
        }));
        await waitForOrder(page, ['bookmarks', 'tabs', 'otherWindows', 'readingList', 'newswire']);
        await page.evaluate(() => chrome.storage.sync.remove('sectionOrder'));
        await waitForOrder(page, DEFAULT_ORDER);
    }, 120000);

    test('stored order is applied on sidepanel load (persists across reload)', async () => {
        await page.evaluate(() => chrome.storage.sync.set({
            sectionOrder: ['readingList', 'bookmarks', 'newswire', 'tabs', 'otherWindows'],
        }));
        await waitForOrder(page, ['readingList', 'bookmarks', 'newswire', 'tabs', 'otherWindows']);

        await page.reload();
        await page.waitForSelector('#tab-list', { timeout: 10000 });
        await waitForOrder(page, ['readingList', 'bookmarks', 'newswire', 'tabs', 'otherWindows']);

        // Restore defaults for any test that follows in this profile.
        await page.evaluate(() => chrome.storage.sync.remove('sectionOrder'));
        await waitForOrder(page, DEFAULT_ORDER);
    }, 120000);

    test('options Appearance exposes a 5-row draggable order list', async () => {
        const optionsPage = await browser.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await optionsPage.waitForSelector('#section-order-list', { timeout: 15000 });

        const rows = await optionsPage.$$eval(
            '#section-order-list > [data-section-id]',
            els => els.map(el => el.dataset.sectionId)
        );
        expect(rows).toEqual(DEFAULT_ORDER);

        // Sortable 已載入且清單列有可讀 label(重用既有 *Header i18n key)。
        const sortableLoaded = await optionsPage.evaluate(() => Boolean(window.Sortable));
        expect(sortableLoaded).toBe(true);
        const firstLabel = await optionsPage.$eval(
            '#section-order-list > [data-section-id="tabs"] .opt-row__label',
            el => el.textContent.trim()
        );
        expect(firstLabel.length).toBeGreaterThan(0);

        await optionsPage.close();
    }, 120000);
});
