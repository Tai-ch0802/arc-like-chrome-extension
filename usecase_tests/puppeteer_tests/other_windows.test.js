const { setupBrowser, teardownBrowser } = require('./setup');

describe('Other Windows Use Case', () => {
    let browser;
    let page;
    let extensionId;
    let sidePanelUrl;
    let secondWindowId = null;
    let createdTabIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        sidePanelUrl = setup.sidePanelUrl;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        // Create a second window with a known tab
        const newWindow = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.windows.create({ url: 'https://example.com', focused: false }, resolve);
            });
        });
        secondWindowId = newWindow.id;
        if (newWindow.tabs && newWindow.tabs.length > 0) {
            createdTabIds.push(newWindow.tabs[0].id);
        }

        // Add another tab to the second window
        const newTab = await page.evaluate((windowId) => {
            return new Promise(resolve => {
                chrome.tabs.create({ windowId: windowId, url: 'https://www.google.com', active: false }, resolve);
            });
        }, secondWindowId);
        createdTabIds.push(newTab.id);

        // Wait for extension to register new window
        await new Promise(r => setTimeout(r, 500));
        await page.reload();
        await page.waitForSelector('#other-windows-list');
    });

    afterEach(async () => {
        // Close the second window
        if (secondWindowId) {
            await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.windows.remove(id, resolve);
                });
            }, secondWindowId);
            secondWindowId = null;
        }
        createdTabIds = [];
    });

    test('should display tabs from other windows in the Other Windows section', async () => {
        // Wait for the Other Windows section to be present
        await page.waitForSelector('#other-windows-list');

        // Find the folder representing the second window
        const otherWindowFolderSelector = '#other-windows-list .window-folder';
        await page.waitForSelector(otherWindowFolderSelector);

        // Click to expand the folder
        await page.click(otherWindowFolderSelector);
        await new Promise(r => setTimeout(r, 300)); // Wait for expansion animation

        // Verify tabs are visible inside the folder-content
        const folderContentSelector = '#other-windows-list .folder-content';
        const tabItems = await page.$$eval(`${folderContentSelector} .tab-item`, items => items.map(el => ({
            title: el.querySelector('.tab-title')?.textContent || '',
            url: el.dataset.url || ''
        })));

        // We created two tabs: example.com and google.com
        const exampleTab = tabItems.find(t => t.url.includes('example.com'));
        const googleTab = tabItems.find(t => t.url.includes('google.com'));

        expect(exampleTab).toBeDefined();
        expect(googleTab).toBeDefined();
    }, 60000);

    test('should NOT allow dragging tabs from Other Windows', async () => {
        // Expand the folder
        const otherWindowFolderSelector = '#other-windows-list .window-folder';
        await page.waitForSelector(otherWindowFolderSelector);
        await page.click(otherWindowFolderSelector);
        await new Promise(r => setTimeout(r, 300));

        // Get a tab item from Other Windows
        const folderContentSelector = '#other-windows-list .folder-content';
        const tabItemSelector = `${folderContentSelector} .tab-item`;
        await page.waitForSelector(tabItemSelector);

        // Check that Sortable is NOT initialized on the folder content
        const hasSortable = await page.$eval(folderContentSelector, el => {
            if (typeof Sortable === 'undefined') return false;
            const instance = Sortable.get(el);
            return instance !== null && instance !== undefined;
        });

        expect(hasSortable).toBe(false);
    }, 60000);
});
