const { setupBrowser, teardownBrowser, waitForTabCount, waitForClass } = require('./setup');

describe('Tab Switch Use Case', () => {
    let browser;
    let page;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        sidePanelUrl = setup.sidePanelUrl;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    afterEach(async () => {
        // Clean up: remove non-extension tabs, keep the sidepanel page
        try {
            await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, tabs => {
                        const idsToClose = tabs
                            .filter(t => !t.url.startsWith('chrome-extension://'))
                            .map(t => t.id);
                        if (idsToClose.length > 0) {
                            chrome.tabs.remove(idsToClose, resolve);
                        } else {
                            resolve();
                        }
                    });
                });
            });
        } catch (e) { /* context may be destroyed */ }

        // Re-navigate unconditionally to restore context
        await page.goto(sidePanelUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForSelector('#tab-list', { timeout: 10000 });
    });

    test('should switch to a different tab when clicking on it', async () => {
        const initialTabItems = await page.$$('.tab-item');
        const initialCount = initialTabItems.length;

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
            await page.waitForFunction(
                (expectedCount) => {
                    return new Promise(resolve => {
                        chrome.tabs.query({}, (tabs) => {
                            resolve(tabs.length >= expectedCount);
                        });
                    });
                },
                { timeout: 10000 },
                initialCount + 2
            );

            await page.reload();
            await page.waitForSelector('.tab-item', { timeout: 10000 });
            await waitForTabCount(page, initialCount + 2);

            const tabItems = await page.$$('.tab-item');
            expect(tabItems.length).toBeGreaterThanOrEqual(2);

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

            await targetTabHandle.click();

            const targetSelector = `.tab-item[data-tab-id="${targetTabId}"]`;
            await waitForClass(page, targetSelector, 'active');

            const activeTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                        resolve(tabs[0]);
                    });
                });
            });

            expect(String(activeTab.id)).toBe(targetTabId);
        } finally {
            try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
        }
    }, 60000);

    test('should update active class in sidebar when tab is switched', async () => {
        const initialTabItems = await page.$$('.tab-item');
        const initialCount = initialTabItems.length;

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
            await page.waitForFunction(
                (expectedCount) => {
                    return new Promise(resolve => {
                        chrome.tabs.query({}, (tabs) => {
                            resolve(tabs.length >= expectedCount);
                        });
                    });
                },
                { timeout: 10000 },
                initialCount + 2
            );

            await page.reload();
            await page.waitForSelector('.tab-item', { timeout: 10000 });
            await waitForTabCount(page, initialCount + 2);

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

            await targetTabHandle.click();

            const targetSelector = `.tab-item[data-tab-id="${targetTabId}"]`;
            await waitForClass(page, targetSelector, 'active');

            const hasActiveClass = await page.$eval(
                targetSelector,
                el => el.classList.contains('active')
            );
            expect(hasActiveClass).toBe(true);
        } finally {
            try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
        }
    }, 60000);
});
