const { setupBrowser, teardownBrowser, waitForTheme } = require('./setup');

/**
 * Theme selection moved out of the in-sidepanel modal and into the dedicated
 * options page (#theme-select-dropdown lives in options.html now). The sidepanel
 * no longer renders the dropdown; instead it reacts to chrome.storage `theme`
 * changes via the settings bridge (settingsBridge.js).
 *
 * These tests drive the theme dropdown on the options page and assert:
 *   - the sidepanel applies the new theme via the storage bridge,
 *   - the dropdown exposes all expected theme options,
 *   - the selection persists across a sidepanel reload.
 */
describe('Theme Switch Use Case (via options page)', () => {
    let browser;
    let page;            // sidepanel page
    let optionsPage;     // options page
    let extensionId;
    let optionsUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        optionsUrl = `chrome-extension://${extensionId}/options.html`;

        await page.waitForSelector('#tab-list', { timeout: 15000 });

        // Open the options page in its own tab (theme dropdown lives here).
        optionsPage = await browser.newPage();
        await optionsPage.goto(optionsUrl, { waitUntil: 'domcontentloaded' });
        await optionsPage.waitForSelector('#theme-select-dropdown', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('selecting a theme on the options page updates the sidepanel via storage bridge', async () => {
        const originalTheme = await page.evaluate(() => document.body.dataset.theme || 'geek');
        const newTheme = originalTheme === 'google' ? 'darcula' : 'google';

        // Change theme on the options page.
        await optionsPage.select('#theme-select-dropdown', newTheme);

        // The options page applies it to its own body for instant preview.
        await waitForTheme(optionsPage, newTheme);

        // The sidepanel reacts via chrome.storage.onChanged (settings bridge).
        await waitForTheme(page, newTheme);
        const sidepanelTheme = await page.evaluate(() => document.body.dataset.theme);
        expect(sidepanelTheme).toBe(newTheme);

        // Restore original theme.
        await optionsPage.select('#theme-select-dropdown', originalTheme);
        await waitForTheme(page, originalTheme);
    }, 120000);

    test('the theme dropdown exposes all expected options', async () => {
        const themeOptions = await optionsPage.$$eval(
            '#theme-select-dropdown option',
            options => options.map(opt => opt.value)
        );

        expect(themeOptions).toContain('geek');
        expect(themeOptions).toContain('google');
        expect(themeOptions).toContain('darcula');
        expect(themeOptions).toContain('geek-blue');
        expect(themeOptions).toContain('christmas');
        expect(themeOptions).toContain('custom');
    }, 120000);

    test('theme selection persists after a sidepanel reload', async () => {
        // Change theme to darcula via the options page.
        await optionsPage.select('#theme-select-dropdown', 'darcula');
        await waitForTheme(optionsPage, 'darcula');
        await waitForTheme(page, 'darcula');

        // Reload the sidepanel — theme must be restored from storage on init.
        await page.reload();
        await page.waitForSelector('#tab-list', { timeout: 10000 });
        await waitForTheme(page, 'darcula');

        const persistedTheme = await page.evaluate(() => document.body.dataset.theme);
        expect(persistedTheme).toBe('darcula');

        // Reset to default theme for other tests.
        await optionsPage.select('#theme-select-dropdown', 'geek');
        await waitForTheme(page, 'geek');
    }, 120000);
});
