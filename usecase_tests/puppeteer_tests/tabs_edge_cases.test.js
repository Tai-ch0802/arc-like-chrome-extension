const { setupBrowser, teardownBrowser } = require('./setup');

describe('Tabs Edge Cases', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close();
    }, 30000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should handle large number of tabs (20+) correctly', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        const tabCount = 20;
        const createdTabIds = [];

        try {
            // Create tabs in batch
            const ids = await page.evaluate((count) => {
                const promises = [];
                for (let i = 0; i < count; i++) {
                    promises.push(new Promise(resolve => {
                        chrome.tabs.create({
                            url: `https://example.com/load-test-${i}`,
                            active: false
                        }, resolve);
                    }));
                }
                return Promise.all(promises).then(tabs => tabs.map(t => t.id));
            }, tabCount);
            createdTabIds.push(...ids);

            // Wait for render
            // Since 50 tabs might take a bit, we poll for count
            await page.waitForFunction((expectedCount) => {
                const items = document.querySelectorAll('.tab-item');
                return items.length >= expectedCount;
            }, { timeout: 30000 }, tabCount);

            // Verify count
            const renderedCount = await page.$$eval('.tab-item', items => items.length);
            expect(renderedCount).toBeGreaterThanOrEqual(tabCount);

        } finally {
            // Cleanup huge number of tabs might be slow, but necessary
             try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 90000); // Extended timeout for large batch

    test('should display pinned tabs', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        let pinnedTabId;
        try {
            const pinnedTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: 'https://example.com/pinned',
                        pinned: true,
                        active: false
                    }, resolve);
                });
            });
            pinnedTabId = pinnedTab.id;

            // Wait for the tab to appear
            await page.waitForSelector(`.tab-item[data-tab-id="${pinnedTabId}"]`);

            // Verify it exists in DOM
            const tabExists = await page.$eval(`.tab-item[data-tab-id="${pinnedTabId}"]`, el => !!el);
            expect(tabExists).toBe(true);

        } finally {
             try {
                if (pinnedTabId) {
                    await page.evaluate((id) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(id, resolve);
                        });
                    }, pinnedTabId);
                }
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 30000);

});
