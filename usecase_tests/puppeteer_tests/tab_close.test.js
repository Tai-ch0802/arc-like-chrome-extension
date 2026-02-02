const { setupBrowser, teardownBrowser } = require('./setup');

describe('Tab Close Use Case', () => {
    let browser;
    let page;
    let createdTabIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        // Create a test tab to close
        const newTab = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.tabs.create({
                    url: 'https://example.com/tab-to-close',
                    active: false
                }, resolve);
            });
        });
        createdTabIds.push(newTab.id);

        // Wait for side panel to update
        await new Promise(r => setTimeout(r, 500));
        await page.reload();
        await page.waitForSelector('.tab-item');
    });

    afterEach(async () => {
        // Cleanup any remaining created tabs
        if (createdTabIds.length > 0) {
            try {
                await page.evaluate((ids) => {
                    return new Promise(resolve => {
                        chrome.tabs.remove(ids, resolve);
                    });
                }, createdTabIds);
            } catch (e) {
                // Tab might already be closed, ignore error
            }
            createdTabIds = [];
        }
    });

    test('should close a tab when clicking the close button', async () => {
        // Find the test tab we created
        const testTabId = createdTabIds[0];
        const tabSelector = `.tab-item[data-tab-id="${testTabId}"]`;

        await page.waitForSelector(tabSelector);

        // Get initial tab count
        const initialTabCount = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.tabs.query({}, tabs => resolve(tabs.length));
            });
        });

        // Hover over the tab to reveal close button
        const tabItem = await page.$(tabSelector);
        await tabItem.hover();
        await new Promise(r => setTimeout(r, 200));

        // Find and click the close button
        const closeBtn = await tabItem.$('.close-btn');
        expect(closeBtn).not.toBeNull();
        await closeBtn.click();

        // Wait for Chrome API to process
        await new Promise(r => setTimeout(r, 500));

        // Verify the tab is closed
        const finalTabCount = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.tabs.query({}, tabs => resolve(tabs.length));
            });
        });

        expect(finalTabCount).toBe(initialTabCount - 1);

        // Verify the tab is no longer in the browser
        const tabExists = await page.evaluate((tabId) => {
            return new Promise(resolve => {
                chrome.tabs.get(tabId, tab => {
                    resolve(!chrome.runtime.lastError && !!tab);
                });
            });
        }, testTabId);

        expect(tabExists).toBe(false);

        // Mark as closed so afterEach doesn't try to close it again
        createdTabIds = [];
    });

    test('should remove tab item from sidebar after closing', async () => {
        const testTabId = createdTabIds[0];
        const tabSelector = `.tab-item[data-tab-id="${testTabId}"]`;

        await page.waitForSelector(tabSelector);

        // Hover and click close
        const tabItem = await page.$(tabSelector);
        await tabItem.hover();
        await new Promise(r => setTimeout(r, 200));
        const closeBtn = await tabItem.$('.close-btn');
        await closeBtn.click();

        // Wait for UI to update
        await new Promise(r => setTimeout(r, 500));

        // Verify the tab item is removed from the DOM
        const tabItemAfterClose = await page.$(tabSelector);
        expect(tabItemAfterClose).toBeNull();

        createdTabIds = [];
    });
}, 60000);
