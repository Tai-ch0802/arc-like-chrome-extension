const { setupBrowser, teardownBrowser, waitForTheme } = require('./setup');

describe('Theme Switch Use Case', () => {
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

    afterEach(async () => {
        // Dismiss any open modal dialog
        try {
            const modalOverlay = await page.$('.modal-overlay');
            if (modalOverlay) {
                await page.evaluate(() => {
                    const overlay = document.querySelector('.modal-overlay');
                    if (overlay) overlay.click();
                });
                await page.waitForFunction(() => !document.querySelector('.modal-overlay'), { timeout: 3000 }).catch(() => { });
            }
        } catch (e) { }
    });

    test('should change theme when selecting from dropdown', async () => {
        await page.waitForSelector('#settings-toggle', { timeout: 10000 });

        // Store original theme
        const originalTheme = await page.evaluate(() => {
            return document.body.dataset.theme || 'geek';
        });

        // Open settings dialog
        await page.click('#settings-toggle');
        await page.waitForSelector('#theme-select-dropdown', { timeout: 5000 });

        // Select a different theme
        const newTheme = originalTheme === 'google' ? 'darcula' : 'google';
        await page.select('#theme-select-dropdown', newTheme);

        await waitForTheme(page, newTheme);

        const appliedTheme = await page.evaluate(() => {
            return document.body.dataset.theme;
        });
        expect(appliedTheme).toBe(newTheme);

        // Restore original theme
        await page.select('#theme-select-dropdown', originalTheme);
        await waitForTheme(page, originalTheme);
    }, 60000);

    test('should persist theme selection after reload', async () => {
        await page.waitForSelector('#settings-toggle', { timeout: 10000 });

        // Open settings and change theme to darcula
        await page.click('#settings-toggle');
        await page.waitForSelector('#theme-select-dropdown', { timeout: 5000 });
        await page.select('#theme-select-dropdown', 'darcula');

        await waitForTheme(page, 'darcula');

        // Close modal by reloading
        await page.reload();
        await page.waitForSelector('#tab-list', { timeout: 10000 });

        // Wait for theme to be restored from storage
        await waitForTheme(page, 'darcula');

        const persistedTheme = await page.evaluate(() => {
            return document.body.dataset.theme;
        });
        expect(persistedTheme).toBe('darcula');

        // Reset to default theme for other tests
        await page.click('#settings-toggle');
        await page.waitForSelector('#theme-select-dropdown', { timeout: 5000 });
        await page.select('#theme-select-dropdown', 'geek');
        await waitForTheme(page, 'geek');
    }, 60000);

    test('should have all expected theme options', async () => {
        await page.waitForSelector('#settings-toggle', { timeout: 10000 });

        // Open settings dialog
        await page.click('#settings-toggle');
        await page.waitForSelector('#theme-select-dropdown', { timeout: 5000 });

        const themeOptions = await page.$$eval('#theme-select-dropdown option', options => {
            return options.map(opt => opt.value);
        });

        expect(themeOptions).toContain('geek');
        expect(themeOptions).toContain('google');
        expect(themeOptions).toContain('darcula');
        expect(themeOptions).toContain('geek-blue');
        expect(themeOptions).toContain('christmas');
        expect(themeOptions).toContain('custom');
    }, 60000);
});
