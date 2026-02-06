const { setupBrowser, teardownBrowser, waitForTabCount } = require('./setup');

describe('Context Menu Use Case', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        // page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should show custom context menu on right-click', async () => {
        // Create a new tab with a valid URL (http/https) to avoid "URL is not supported" error from Reading List API
        // which might occur with about:blank
        await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.tabs.create({ url: 'https://example.com', active: false }, resolve);
            });
        });

        // Wait for the tab to appear in the list
        // We expect existing tabs + 1.
        // We can't easily know exact count, but we can wait for a tab with specific data-url
        await page.waitForFunction(() => {
            return !!document.querySelector('.tab-item[data-url="https://example.com/"]');
        });

        const targetTab = await page.$('.tab-item[data-url="https://example.com/"]');
        expect(targetTab).not.toBeNull();

        // Right-click on the target tab
        await targetTab.click({ button: 'right' });

        // Wait for the custom context menu to appear
        await page.waitForSelector('.custom-context-menu');

        // Check if the menu contains expected items
        const menuItems = await page.$$('.custom-context-menu .context-menu-item');
        expect(menuItems.length).toBeGreaterThan(0);

        // Check specifically for Copy URL icon or text structure
        const hasMenuItem = await page.$eval('.custom-context-menu', el => {
            return el.querySelectorAll('[role="menuitem"]').length > 0;
        });
        expect(hasMenuItem).toBe(true);

        // Close the menu by clicking elsewhere
        await page.mouse.click(1, 1);

        // Wait for the menu to disappear
        await page.waitForFunction(() => !document.querySelector('.custom-context-menu'));

        const menuExists = await page.$('.custom-context-menu');
        expect(menuExists).toBeNull();

        // Cleanup the created tab
        await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.tabs.query({ url: 'https://example.com/' }, tabs => {
                    if (tabs.length > 0) {
                        chrome.tabs.remove(tabs[0].id, resolve);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }, 60000);
});
