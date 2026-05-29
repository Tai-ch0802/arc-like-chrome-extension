const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * The in-sidepanel settings dialog was removed. Clicking the gear button
 * (#settings-toggle) now calls chrome.runtime.openOptionsPage(), which opens
 * options.html (options_ui + open_in_tab) in a NEW tab.
 *
 * This suite verifies the new behavior:
 *   1. No .modal-overlay appears after clicking the gear (the old dialog is gone).
 *   2. Clicking the gear opens a new tab/target whose URL ends with options.html.
 */
describe('Settings Panel Use Case (opens options page)', () => {
    let browser;
    let page;
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;

        // Wait for app initialization
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await page.waitForSelector('#settings-toggle', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('clicking the gear opens the options page in a new tab (no in-panel modal)', async () => {
        const optionsUrl = `chrome-extension://${extensionId}/options.html`;

        // Record targets that already point at options.html (should be none).
        const before = (await browser.targets())
            .filter(t => /\/options\.html(?:[?#].*)?$/.test(t.url()));
        expect(before.length).toBe(0);

        // Start waiting for the options-page target BEFORE clicking, so we don't
        // miss it if the new tab navigates quickly. waitForTarget also fires on
        // URL changes, so a tab that opens as about:blank then navigates to
        // options.html is still caught.
        const matcher = t => /\/options\.html(?:[?#].*)?$/.test(t.url());
        const optionsTargetPromise = browser.waitForTarget(matcher, { timeout: 20000 });

        // Click the gear button with a TRUSTED user gesture. This matters:
        // chrome.runtime.openOptionsPage() requires user activation, so an
        // untrusted programmatic .click() (via page.evaluate) is silently
        // ignored. page.click() dispatches a real input event.
        await page.click('#settings-toggle');

        // The gear MUST have opened the options page. If it never does, this
        // rejects and fails the test (the test is meaningful: it breaks if the
        // gear stops opening the options page).
        const optionsTarget = await optionsTargetPromise;
        expect(optionsTarget).toBeTruthy();
        expect(optionsTarget.url()).toBe(optionsUrl);

        // The legacy in-panel dialog must NOT appear in the sidepanel.
        const modalInPanel = await page.$('.modal-overlay');
        expect(modalInPanel).toBeNull();

        // Clean up: close the options tab so it doesn't leak into other assertions.
        try {
            const optPage = await optionsTarget.page();
            if (optPage) await optPage.close();
        } catch (_) { /* target may already be detached */ }
    }, 30000);
});
