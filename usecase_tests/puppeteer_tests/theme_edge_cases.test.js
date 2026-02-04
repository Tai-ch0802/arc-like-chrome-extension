const { setupBrowser, teardownBrowser } = require('./setup');

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

            // Allow some time for async storage check and theme application
            await new Promise(r => setTimeout(r, 500));

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
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

});
