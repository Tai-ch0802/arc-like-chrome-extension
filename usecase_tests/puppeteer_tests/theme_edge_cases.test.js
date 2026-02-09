const { setupBrowser, teardownBrowser, waitForTheme } = require('./setup');

describe('Theme Edge Cases', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

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

    test('should fallback to default theme if custom theme data is missing', async () => {
        try {
            await page.waitForSelector('.tab-item', { timeout: 10000 });

            // Manually corrupt the state: set theme to 'custom' but ensure no custom theme data exists
            await page.evaluate(async () => {
                await chrome.storage.sync.set({ theme: 'custom' });
                await chrome.storage.sync.remove('customTheme');
            });

            // Reload page to trigger initThemeSwitcher logic
            await page.reload();
            await page.waitForSelector('.tab-item', { timeout: 10000 });

            await waitForTheme(page, 'geek');

            const theme = await page.evaluate(() => document.body.dataset.theme);
            expect(theme).toBe('geek');

            const storedTheme = await page.evaluate(async () => {
                const data = await chrome.storage.sync.get('theme');
                return data.theme;
            });
            expect(storedTheme).toBe('geek');

        } catch (e) {
            throw e;
        }
    }, 120000);

    test('should handle rapid theme switching without crashing', async () => {
        await page.waitForSelector('#settings-toggle', { timeout: 10000 });

        try {
            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown', { timeout: 15000 });

            const themes = ['geek', 'google', 'darcula', 'geek-blue'];

            // Rapidly select themes
            for (const theme of themes) {
                await page.select('#theme-select-dropdown', theme);
            }

            // Finally select one and verify it settles
            await page.select('#theme-select-dropdown', 'geek');
            await waitForTheme(page, 'geek');

            const isAlive = await page.evaluate(() => document.body.dataset.theme === 'geek');
            expect(isAlive).toBe(true);

        } catch (e) {
            throw e;
        }
    }, 120000);

    test('should handle storage quota exceeded gracefully', async () => {
        await page.waitForSelector('#settings-toggle', { timeout: 10000 });

        try {
            // Mock storage.sync.set failure
            await page.evaluate(() => {
                try {
                    chrome.storage.sync.set = (items, callback) => {
                        console.log('Mocking storage error');
                        setTimeout(() => {
                            chrome.runtime.lastError = { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' };
                            if (callback) callback();
                            chrome.runtime.lastError = undefined;
                        }, 10);
                    };
                } catch (e) {
                    console.error('Failed to mock storage', e);
                }
            });

            await page.click('#settings-toggle');
            await page.waitForSelector('#theme-select-dropdown', { timeout: 15000 });

            // Trigger save
            await page.select('#theme-select-dropdown', 'darcula');

            await waitForTheme(page, 'darcula');

            const dropdown = await page.$('#theme-select-dropdown');
            expect(dropdown).not.toBeNull();

        } catch (e) {
            throw e;
        }
    }, 120000);

});
