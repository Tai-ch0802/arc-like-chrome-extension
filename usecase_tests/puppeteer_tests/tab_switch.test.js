const { setupBrowser, teardownBrowser, waitForTabCount, waitForClass } = require('./setup');

describe('Tab Switch Use Case', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        // Close the initial page, we'll create fresh ones per test
        await setup.page.close();
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should switch to a different tab when clicking on it', async () => {
        // Create a fresh page for this test
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        // Get initial tab count
        const initialTabItems = await page.$$('.tab-item');
        const initialCount = initialTabItems.length;

        // Create test tabs
        const createdTabIds = [];
        for (let i = 0; i < 2; i++) {
            const newTab = await page.evaluate((index) => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: `https://example.com/switch-test-${index}`,
                        active: false
                    }, resolve);
                });
            }, i);
            createdTabIds.push(newTab.id);
        }

        try {
            // Wait for new tabs to appear in DOM, then reload
            await page.reload();
            await page.waitForSelector('.tab-item');
            // Wait for expected tab count
            await waitForTabCount(page, initialCount + 2);

            // Get all tab items
            const tabItems = await page.$$('.tab-item');
            expect(tabItems.length).toBeGreaterThanOrEqual(2);

            // Find a non-active tab to click
            let targetTabHandle = null;
            let targetTabId = null;
            for (const tabItem of tabItems) {
                const isActive = await tabItem.evaluate(el => el.classList.contains('active'));
                if (!isActive) {
                    targetTabHandle = tabItem;
                    targetTabId = await tabItem.evaluate(el => el.dataset.tabId);
                    break;
                }
            }

            expect(targetTabHandle).not.toBeNull();

            // Click on the non-active tab
            await targetTabHandle.click();

            // Wait for the tab to become active in the UI
            const targetSelector = `.tab-item[data-tab-id="${targetTabId}"]`;
            await waitForClass(page, targetSelector, 'active');

            // Verify the tab is now active in Chrome
            const activeTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                        resolve(tabs[0]);
                    });
                });
            });

            expect(String(activeTab.id)).toBe(targetTabId);
        } finally {
            // Cleanup: remove created tabs
            try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
            await page.close();
        }
    }, 60000);

    test('should update active class in sidebar when tab is switched', async () => {
        // Create a fresh page for this test
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        // Get initial tab count
        const initialTabItems = await page.$$('.tab-item');
        const initialCount = initialTabItems.length;

        // Create test tabs
        const createdTabIds = [];
        for (let i = 0; i < 2; i++) {
            const newTab = await page.evaluate((index) => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: `https://example.com/active-test-${index}`,
                        active: false
                    }, resolve);
                });
            }, i);
            createdTabIds.push(newTab.id);
        }

        try {
            // Wait and reload
            await page.reload();
            await page.waitForSelector('.tab-item');
            await waitForTabCount(page, initialCount + 2);

            // Get a non-active tab
            const tabItems = await page.$$('.tab-item');
            let targetTabHandle = null;
            let targetTabId = null;

            for (const tabItem of tabItems) {
                const isActive = await tabItem.evaluate(el => el.classList.contains('active'));
                if (!isActive) {
                    targetTabHandle = tabItem;
                    targetTabId = await tabItem.evaluate(el => el.dataset.tabId);
                    break;
                }
            }

            if (!targetTabHandle) {
                console.log('No non-active tab found, skipping');
                return;
            }

            // Click to switch
            await targetTabHandle.click();

            // Wait for the target tab to have 'active' class
            const targetSelector = `.tab-item[data-tab-id="${targetTabId}"]`;
            await waitForClass(page, targetSelector, 'active');

            // Verify the clicked tab now has 'active' class
            const hasActiveClass = await page.$eval(
                targetSelector,
                el => el.classList.contains('active')
            );
            expect(hasActiveClass).toBe(true);
        } finally {
            // Cleanup
            try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
            await page.close();
        }
    }, 60000);
}, 180000);
