const { setupBrowser, teardownBrowser, waitForTabCount } = require('./setup');

describe('Context Menu Use Case', () => {
    let browser;
    let page;
    let createdTabUrl = 'https://example.com';

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    afterEach(async () => {
        // Ensure cleanup of any created test tabs, even if test assertions fail
        await page.evaluate((url) => {
            return new Promise(resolve => {
                chrome.tabs.query({}, tabs => {
                    const target = tabs.find(t => t.url && t.url.startsWith(url));
                    if (target) {
                        chrome.tabs.remove(target.id, resolve);
                    } else {
                        resolve();
                    }
                });
            });
        }, createdTabUrl);

        // Dismiss any leftover context menu
        const menuExists = await page.$('.custom-context-menu');
        if (menuExists) {
            await page.evaluate(() => {
                document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await page.waitForFunction(() => !document.querySelector('.custom-context-menu'), { timeout: 3000 }).catch(() => { });
        }
    });

    test('should show custom context menu on right-click', async () => {
        // Create a new tab with a valid URL (http/https) to avoid "URL is not supported" error from Reading List API
        await page.evaluate((url) => {
            return new Promise(resolve => {
                chrome.tabs.create({ url, active: false }, resolve);
            });
        }, createdTabUrl);

        // Wait for the tab to appear in the list using startsWith to avoid trailing slash differences
        await page.waitForFunction((url) => {
            return !!Array.from(document.querySelectorAll('.tab-item')).find(
                el => el.dataset.url && el.dataset.url.startsWith(url)
            );
        }, { timeout: 10000 }, createdTabUrl);

        const targetTab = await page.evaluateHandle((url) => {
            return Array.from(document.querySelectorAll('.tab-item')).find(
                el => el.dataset.url && el.dataset.url.startsWith(url)
            );
        }, createdTabUrl);

        expect(targetTab).not.toBeNull();

        // Right-click on the target tab
        await targetTab.click({ button: 'right' });

        // Wait for the custom context menu to appear
        await page.waitForSelector('.custom-context-menu', { timeout: 15000 });

        // Check if the menu contains expected items
        const menuItems = await page.$$('.custom-context-menu .context-menu-item');
        expect(menuItems.length).toBeGreaterThan(0);

        // Check specifically for menuitem role
        const hasMenuItem = await page.$eval('.custom-context-menu', el => {
            return el.querySelectorAll('[role="menuitem"]').length > 0;
        });
        expect(hasMenuItem).toBe(true);

        // Close the menu — contextMenuManager registers the click listener with setTimeout(0),
        // so we need to wait a tick before dispatching the click event
        await page.evaluate(() => {
            return new Promise(resolve => {
                setTimeout(() => {
                    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    resolve();
                }, 50);
            });
        });

        // Wait for the menu to disappear
        await page.waitForFunction(() => !document.querySelector('.custom-context-menu'), { timeout: 15000 });

        const menuGone = await page.$('.custom-context-menu');
        expect(menuGone).toBeNull();
    }, 120000);
});
