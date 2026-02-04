const { setupBrowser, teardownBrowser, waitForTabCount } = require('./setup');

describe('Tab Edge Cases', () => {
    let browser;
    let extensionId;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        extensionId = setup.extensionId;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close(); // Close initial page
    }, 60000); // 60s timeout for setup

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should render a large number of tabs (20+)', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        try {
            // Wait for initial load
            await page.waitForSelector('.tab-item');

            // Get initial tab count
            const initialCount = await page.$$eval('.tab-item', tabs => tabs.length);

            // Create 20 tabs
            await page.evaluate(async () => {
                const promises = [];
                for (let i = 0; i < 20; i++) {
                    promises.push(new Promise(resolve => {
                        chrome.tabs.create({ url: `https://example.com/${i}`, active: false }, resolve);
                    }));
                }
                await Promise.all(promises);
            });

            // Wait for tabs to render using state-based waiting
            await waitForTabCount(page, initialCount + 20);

            // Verify count
            const tabCount = await page.$$eval('.tab-item', tabs => tabs.length);
            // 20 new tabs + initial tabs
            expect(tabCount).toBeGreaterThanOrEqual(initialCount + 20);

        } finally {
            try { await page.close(); } catch (e) { /* intentionally ignored - cleanup only */ }
        }
    }, 60000);

    test('should render pinned tabs correctly', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        try {
            await page.waitForSelector('.tab-item');

            // Create a pinned tab
            await page.evaluate(async () => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/pinned', pinned: true, active: false }, resolve);
                });
            });

            // Wait for the pinned tab to appear in the DOM (state-based waiting)
            await page.waitForSelector('.tab-item[data-url="https://example.com/pinned"]', { timeout: 5000 });

            // Verify tab exists and has pinned data/url
            // Note: Our current UI might not explicitly verify "visual" pinned state without screenshot,
            // but we can verify the tab with that URL exists.
            // If the UI exposed 'pinned' class or attribute we could check that.
            // Let's check if the API returns it as pinned and UI renders it.

            const pinnedTabExists = await page.evaluate(async () => {
                const tabs = await new Promise(resolve => chrome.tabs.query({ pinned: true }, resolve));
                return tabs.some(t => t.url === 'https://example.com/pinned');
            });
            expect(pinnedTabExists).toBe(true);

            // Check if it is in DOM (already confirmed by waitForSelector, but verify explicitly)
            const tabInDom = await page.$eval('.tab-item[data-url="https://example.com/pinned"]', el => !!el);
            expect(tabInDom).toBe(true);

        } finally {
            try { await page.close(); } catch (e) { /* intentionally ignored - cleanup only */ }
        }
    }, 60000);

    test('should update tab UI when URL changes', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        try {
            await page.waitForSelector('.tab-item');

            // Create a tab
            const tabId = await page.evaluate(async () => {
                const tab = await new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/original', active: false }, resolve);
                });
                return tab.id;
            });

            // Wait for render
            await page.waitForSelector(`.tab-item[data-tab-id="${tabId}"]`);

            // Update URL
            await page.evaluate(async (id) => {
                await new Promise(resolve => {
                    chrome.tabs.update(id, { url: 'https://example.com/updated' }, resolve);
                });
            }, tabId);

            // Wait for UI update using state-based waiting (wait for data-url attribute to change)
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
            try { await page.close(); } catch (e) { /* intentionally ignored - cleanup only */ }
        }
    }, 60000);

});
