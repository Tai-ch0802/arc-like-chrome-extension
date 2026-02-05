const { setupBrowser, teardownBrowser, waitForTheme } = require('./setup');

describe('Theme Edge Cases', () => {
    let browser;
    let extensionId;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        extensionId = setup.extensionId;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close(); // Close initial page
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should fallback to default theme if custom theme data is missing', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        try {
            // Wait for initial load
            await page.waitForSelector('.tab-item');

            // Manually corrupt the state: set theme to 'custom' but ensure no custom theme data exists
            await page.evaluate(async () => {
                await chrome.storage.sync.set({ theme: 'custom' });
                await chrome.storage.sync.remove('customTheme');
            });

            // Reload page to trigger initThemeSwitcher logic
            await page.reload();
            await page.waitForSelector('.tab-item');

            // Wait for theme to be applied using state-based waiting
            await waitForTheme(page, 'geek');

            // Verify body dataset theme is 'geek' (default)
            const theme = await page.evaluate(() => document.body.dataset.theme);
            expect(theme).toBe('geek');

            // Verify storage was updated to 'geek'
            const storedTheme = await page.evaluate(async () => {
                const data = await chrome.storage.sync.get('theme');
                return data.theme;
            });
            expect(storedTheme).toBe('geek');

        } finally {
            try { await page.close(); } catch (e) { /* intentionally ignored - cleanup only */ }
        }
    }, 60000);

    test('should handle rapid theme switching without crashing', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#settings-toggle');

        try {
            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown');

            const themes = ['geek', 'google', 'darcula', 'geek-blue'];

            // Rapidly select themes
            for (const theme of themes) {
                await page.select('#theme-select-dropdown', theme);
                // No await for theme application to simulate rapid user action
            }

            // Finally select one and verify it settles
            await page.select('#theme-select-dropdown', 'geek');
            await waitForTheme(page, 'geek');

            // Verify app is still alive
            const isAlive = await page.evaluate(() => document.body.dataset.theme === 'geek');
            expect(isAlive).toBe(true);

        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should handle storage quota exceeded gracefully', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#settings-toggle');

        try {
            // Mock storage.sync.set failure
            await page.evaluate(() => {
                // We don't overwrite the original function but the property on the object
                // Note: In some environments chrome.storage.sync might be read-only/configurable.
                // If this fails, we skip.
                try {
                    const originalSet = chrome.storage.sync.set;
                    // We need to overwrite it on the prototype or the object instance?
                    // Puppeteer evaluate context is separate.
                    // Usually overriding works.
                    chrome.storage.sync.set = (items, callback) => {
                        console.log('Mocking storage error');
                        // Simulate async callback
                        setTimeout(() => {
                            chrome.runtime.lastError = { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' };
                            if (callback) callback();
                            chrome.runtime.lastError = undefined;
                        }, 10);
                    };
                } catch(e) {
                    console.error('Failed to mock storage', e);
                }
            });

            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown');

            // Trigger save
            await page.select('#theme-select-dropdown', 'darcula');

            // Wait for theme to be applied in DOM (optimistic update)
            await waitForTheme(page, 'darcula');

            // Verify no crash (element still exists)
            const dropdown = await page.$('#theme-select-dropdown');
            expect(dropdown).not.toBeNull();

        } finally {
             try { await page.close(); } catch (e) { }
        }
    }, 60000);

});
