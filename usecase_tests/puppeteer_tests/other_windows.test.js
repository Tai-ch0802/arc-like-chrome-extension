const { setupBrowser, teardownBrowser } = require('./setup');

describe('Other Windows Use Case', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should display tabs from other windows in the Other Windows section', async () => {
        let secondWindowId = null;

        try {
            // Create a second window
            const newWindow = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.windows.create({ url: 'https://example.com', focused: false }, resolve);
                });
            });
            secondWindowId = newWindow.id;

            // Add another tab to the second window
            await page.evaluate((windowId) => {
                return new Promise(resolve => {
                    chrome.tabs.create({ windowId: windowId, url: 'https://www.google.com', active: false }, resolve);
                });
            }, secondWindowId);

            // Wait for "Other Windows" section to update.
            const windowFolderSelector = '#other-windows-list .window-folder';

            try {
                await page.waitForSelector(windowFolderSelector, { timeout: 5000 });
            } catch (e) {
                // If listener didn't fire (headless env quirks), try reload
                console.log("Other Windows not appeared, reloading...");
                await page.reload();
                await page.waitForSelector('#tab-list', { timeout: 10000 });
                await page.waitForSelector(windowFolderSelector, { timeout: 10000 });
            }

            // Click to expand
            await page.$eval(windowFolderSelector, el => el.click());

            // Wait for expansion
            const folderContentSelector = '#other-windows-list .folder-content';
            await page.waitForFunction((selector) => {
                const el = document.querySelector(selector);
                return el && el.style.display !== 'none' && !el.classList.contains('hidden');
            }, { timeout: 5000 }, folderContentSelector);

            // Verify tabs
            await page.waitForFunction((selector) => {
                const items = document.querySelectorAll(`${selector} .tab-item`);
                return items.length >= 2;
            }, { timeout: 5000 }, folderContentSelector);

            const tabItems = await page.$$eval(`${folderContentSelector} .tab-item`, items => items.map(el => ({
                url: el.dataset.url,
                title: el.querySelector('.tab-title').textContent
            })));
            console.log("Tab Items found:", tabItems);

            expect(tabItems.length).toBeGreaterThanOrEqual(2);

        } finally {
            if (secondWindowId) {
                try {
                    await page.evaluate((id) => {
                        return new Promise(resolve => chrome.windows.remove(id, resolve));
                    }, secondWindowId);
                } catch (e) { }
            }
        }
    }, 60000);

    test('should NOT allow dragging tabs from Other Windows', async () => {
        let secondWindowId = null;
        try {
            const newWindow = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.windows.create({ url: 'https://example.com', focused: false }, resolve);
                });
            });
            secondWindowId = newWindow.id;

            const windowFolderSelector = '#other-windows-list .window-folder';
            try {
                await page.waitForSelector(windowFolderSelector, { timeout: 5000 });
            } catch (e) {
                await page.reload();
                await page.waitForSelector('#tab-list', { timeout: 10000 });
                await page.waitForSelector(windowFolderSelector, { timeout: 10000 });
            }

            // Expand
            await page.$eval(windowFolderSelector, el => el.click());
            const folderContentSelector = '#other-windows-list .folder-content';

            await page.waitForFunction((selector) => {
                const el = document.querySelector(selector);
                return el && el.style.display !== 'none';
            }, { timeout: 5000 }, folderContentSelector);

            // Check Sortable
            const sortableInstance = await page.$eval(folderContentSelector, el => {
                return (typeof Sortable !== 'undefined' && Sortable.get(el)) ? true : false;
            });
            expect(sortableInstance).toBe(false);

        } finally {
            if (secondWindowId) {
                try {
                    await page.evaluate((id) => {
                        return new Promise(resolve => chrome.windows.remove(id, resolve));
                    }, secondWindowId);
                } catch (e) { }
            }
        }
    }, 60000);
});
