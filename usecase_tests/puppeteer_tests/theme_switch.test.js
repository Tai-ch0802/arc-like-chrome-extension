const { setupBrowser, teardownBrowser } = require('./setup');

describe('Theme Switch Use Case', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close();
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should change theme when selecting from dropdown', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        // Wait for tab list to load to ensure app is initialized and listeners are attached
        await page.waitForSelector('.tab-item', { timeout: 10000 }).catch(() => {
             // If no tabs are rendered (unlikely but possible in empty state), wait a safe delay
             return new Promise(r => setTimeout(r, 1000));
        });
        await page.waitForSelector('#settings-toggle');

        try {
            // Store original theme
            const originalTheme = await page.evaluate(() => {
                return document.body.dataset.theme || 'geek';
            });

            // Open settings dialog
            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown');

            // Select a different theme
            const newTheme = originalTheme === 'google' ? 'darcula' : 'google';
            await page.select('#theme-select-dropdown', newTheme);
            await new Promise(r => setTimeout(r, 300));

            // Verify body has new theme
            const appliedTheme = await page.evaluate(() => {
                return document.body.dataset.theme;
            });
            expect(appliedTheme).toBe(newTheme);

            // Restore original theme
            await page.select('#theme-select-dropdown', originalTheme);
            await new Promise(r => setTimeout(r, 200));
        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should persist theme selection after reload', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        // Wait for initialization
        await page.waitForSelector('.tab-item', { timeout: 10000 }).catch(() => new Promise(r => setTimeout(r, 1000)));
        await page.waitForSelector('#settings-toggle');

        try {
            // Open settings and change theme to darcula
            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown');
            await page.select('#theme-select-dropdown', 'darcula');
            await new Promise(r => setTimeout(r, 500));

            // Close modal by clicking outside or reloading
            await page.reload();
            await page.waitForSelector('#tab-list');
            await new Promise(r => setTimeout(r, 500));

            // Verify theme persisted
            const persistedTheme = await page.evaluate(() => {
                return document.body.dataset.theme;
            });
            expect(persistedTheme).toBe('darcula');

            // Reset to default theme for other tests
            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown');
            await page.select('#theme-select-dropdown', 'geek');
            await new Promise(r => setTimeout(r, 200));
        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should have all expected theme options', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        // Wait for initialization
        await page.waitForSelector('.tab-item', { timeout: 10000 }).catch(() => new Promise(r => setTimeout(r, 1000)));
        await page.waitForSelector('#settings-toggle');

        try {
            // Open settings dialog
            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown');

            // Get all theme options
            const themeOptions = await page.$$eval('#theme-select-dropdown option', options => {
                return options.map(opt => opt.value);
            });

            // Verify expected themes exist
            expect(themeOptions).toContain('geek');
            expect(themeOptions).toContain('google');
            expect(themeOptions).toContain('darcula');
            expect(themeOptions).toContain('geek-blue');
            expect(themeOptions).toContain('christmas');
            expect(themeOptions).toContain('custom');
        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);
}, 240000);
