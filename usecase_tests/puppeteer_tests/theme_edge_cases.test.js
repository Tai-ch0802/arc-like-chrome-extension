const { setupBrowser, teardownBrowser, waitForTheme } = require('./setup');

/**
 * Theme edge cases.
 *
 * Settings (incl. #theme-select-dropdown) moved out of the in-sidepanel modal
 * into the dedicated options page (options.html) in batch D. The sidepanel gear
 * (#settings-toggle) now opens the options page in a new tab and the sidepanel
 * reacts to chrome.storage `theme` changes via the settings bridge
 * (settingsBridge.js).
 *
 * Tests 2 & 3 therefore drive the dropdown on the options page rather than the
 * removed sidepanel modal. Test 1 only manipulates storage + reloads the
 * sidepanel, so it is unchanged.
 */
describe('Theme Edge Cases', () => {
    let browser;
    let page;            // sidepanel page
    let optionsPage;     // options page (theme dropdown lives here)
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;

        await page.waitForSelector('#tab-list', { timeout: 15000 });

        // Open the options page in its own tab (theme dropdown lives here).
        optionsPage = await browser.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await optionsPage.waitForSelector('#theme-select-dropdown', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should fallback to default theme if custom theme data is missing', async () => {
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
    }, 120000);

    test('should handle rapid theme switching without crashing', async () => {
        const themes = ['geek', 'google', 'darcula', 'geek-blue'];

        // Rapidly select themes on the options page.
        for (const theme of themes) {
            await optionsPage.select('#theme-select-dropdown', theme);
        }

        // Finally settle on 'geek' and verify the sidepanel applies it via the
        // storage bridge (geek-blue -> geek is a real change, so onChanged fires).
        await optionsPage.select('#theme-select-dropdown', 'geek');
        await waitForTheme(page, 'geek');

        const sidepanelTheme = await page.evaluate(() => document.body.dataset.theme === 'geek');
        expect(sidepanelTheme).toBe(true);

        // The options page survived the rapid switching — dropdown still present.
        const dropdown = await optionsPage.$('#theme-select-dropdown');
        expect(dropdown).not.toBeNull();
    }, 120000);

    test('should handle storage quota exceeded gracefully', async () => {
        // Mock storage.sync.set failure ON THE OPTIONS PAGE — the theme write now
        // happens there via api.setStorage('sync', { theme }). The non-strict
        // setStorage swallows lastError and still resolves, so the options page
        // proceeds to apply the theme to its own body for preview. The point of
        // this test is "no crash on a failed sync write", not persistence.
        await optionsPage.evaluate(() => {
            window.__originalSyncSet = chrome.storage.sync.set;
            chrome.storage.sync.set = (items, callback) => {
                console.log('Mocking storage quota error');
                setTimeout(() => {
                    chrome.runtime.lastError = { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' };
                    if (callback) callback();
                    chrome.runtime.lastError = undefined;
                }, 10);
            };
        });

        try {
            // Trigger save on the options page.
            await optionsPage.select('#theme-select-dropdown', 'darcula');

            // No crash: the options page applied the theme to its own body for
            // preview, and the dropdown is still present.
            await waitForTheme(optionsPage, 'darcula');

            const optionsBodyTheme = await optionsPage.evaluate(() => document.body.dataset.theme);
            expect(optionsBodyTheme).toBe('darcula');

            const dropdown = await optionsPage.$('#theme-select-dropdown');
            expect(dropdown).not.toBeNull();
        } finally {
            // Restore the real storage API and reset theme to default.
            await optionsPage.evaluate(() => {
                if (window.__originalSyncSet) {
                    chrome.storage.sync.set = window.__originalSyncSet;
                    delete window.__originalSyncSet;
                }
            });
            await optionsPage.select('#theme-select-dropdown', 'geek');
        }
    }, 120000);
});
