const { setupBrowser, teardownBrowser, waitForTabCount } = require('./setup');

describe('Tab Edge Cases', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        // Wait for initial app load
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should render a large number of tabs (50+)', async () => {
        try {
            // Get initial tab count
            const initialCount = await page.$$eval('.tab-item', tabs => tabs.length);

            // Create 50 tabs
            await page.evaluate(async () => {
                const promises = [];
                for (let i = 0; i < 50; i++) {
                    promises.push(new Promise(resolve => {
                        chrome.tabs.create({ url: `https://example.com/load-${i}`, active: false }, resolve);
                    }));
                }
                await Promise.all(promises);
            });

            // Wait for tabs to render
            await waitForTabCount(page, initialCount + 50, 60000);

            // Verify count
            const tabCount = await page.$$eval('.tab-item', tabs => tabs.length);
            expect(tabCount).toBeGreaterThanOrEqual(initialCount + 50);

        } finally {
            // Cleanup tabs created during test
            try {
                await page.evaluate(async () => {
                    const tabs = await new Promise(r => chrome.tabs.query({}, r));
                    const testTabs = tabs.filter(t => t.url && t.url.includes('example.com/load-'));
                    if (testTabs.length > 0) {
                        const ids = testTabs.map(t => t.id);
                        await new Promise(r => chrome.tabs.remove(ids, r));
                    }
                });
                // Wait for removal to reflect
                await page.waitForFunction(
                    () => {
                        const items = document.querySelectorAll('.tab-item[data-url*="example.com/load-"]');
                        return items.length === 0;
                    },
                    { timeout: 10000 }
                ).catch(() => { });
            } catch (e) { /* cleanup best-effort */ }
        }
    }, 90000);

    test('should render pinned tabs correctly', async () => {
        let pinnedTabId;
        try {
            // Create a pinned tab
            const tab = await page.evaluate(async () => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/pinned', pinned: true, active: false }, resolve);
                });
            });
            pinnedTabId = tab.id;

            // Wait for the pinned tab to appear in the DOM
            await page.waitForFunction(
                (url) => document.querySelector(`.tab-item[data-url="${url}"]`),
                { timeout: 10000 },
                'https://example.com/pinned'
            );

            // Verify tab exists via Chrome API
            const pinnedTabExists = await page.evaluate(async () => {
                const tabs = await new Promise(resolve => chrome.tabs.query({ pinned: true }, resolve));
                return tabs.some(t => t.url === 'https://example.com/pinned');
            });
            expect(pinnedTabExists).toBe(true);

        } finally {
            if (pinnedTabId) {
                try {
                    await page.evaluate((id) => chrome.tabs.remove(id), pinnedTabId);
                } catch (e) { }
            }
        }
    }, 30000);

    test('should update tab UI when URL changes', async () => {
        let tabId;
        try {
            // Create a tab
            const tab = await page.evaluate(async () => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/original', active: false }, resolve);
                });
            });
            tabId = tab.id;

            // Wait for render
            await page.waitForSelector(`.tab-item[data-tab-id="${tabId}"]`, { timeout: 10000 });

            // Update URL
            await page.evaluate(async (id) => {
                await new Promise(resolve => {
                    chrome.tabs.update(id, { url: 'https://example.com/updated' }, resolve);
                });
            }, tabId);

            // Wait for UI update
            await page.waitForFunction(
                (id, expectedUrl) => {
                    const el = document.querySelector(`.tab-item[data-tab-id="${id}"]`);
                    return el && el.dataset.url === expectedUrl;
                },
                { timeout: 10000 },
                tabId,
                'https://example.com/updated'
            );

            // Verify DOM data-url update
            const newUrl = await page.$eval(`.tab-item[data-tab-id="${tabId}"]`, el => el.dataset.url);
            expect(newUrl).toBe('https://example.com/updated');

        } finally {
            if (tabId) {
                try {
                    await page.evaluate((id) => chrome.tabs.remove(id), tabId);
                } catch (e) { }
            }
        }
    }, 30000);
});
