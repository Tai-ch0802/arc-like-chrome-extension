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

        const matcher = t => /\/options\.html(?:[?#].*)?$/.test(t.url());

        // Record targets that already point at options.html (should be none).
        const before = (await browser.targets()).filter(matcher);
        expect(before.length).toBe(0);

        // Ensure the sidepanel page has focus/visibility before clicking so the
        // synthetic input event reliably counts as a user activation. Under
        // concurrent load (maxWorkers) a background page can drop activation,
        // making chrome.runtime.openOptionsPage() a silent no-op.
        await page.bringToFront();
        await page.waitForSelector('#settings-toggle', { visible: true, timeout: 15000 });

        // Detect the options-page target with a generous overall budget. A single
        // click can be dropped under load (lost user activation -> no-op), so we
        // re-issue a TRUSTED page.click() on each attempt while the target has not
        // yet appeared. We set up waitForTarget BEFORE clicking each round to avoid
        // a race where the target is created before the wait begins.
        //
        // page.click() (NOT page.evaluate click) is required: openOptionsPage()
        // needs real user activation; an untrusted programmatic click is ignored.
        const OVERALL_TIMEOUT_MS = 20000;
        const PER_ATTEMPT_MS = 5000;
        const deadline = Date.now() + OVERALL_TIMEOUT_MS;
        let optionsTarget = null;

        while (Date.now() < deadline) {
            const remaining = Math.max(1000, deadline - Date.now());
            const waitMs = Math.min(PER_ATTEMPT_MS, remaining);
            const optionsTargetPromise = browser
                .waitForTarget(matcher, { timeout: waitMs })
                .catch(() => null);

            await page.click('#settings-toggle');

            optionsTarget = await optionsTargetPromise;
            if (optionsTarget) break;
        }

        // The gear MUST have opened the options page. If it never does, this
        // assertion fails (the test stays meaningful: it breaks if the gear
        // stops opening the options page).
        expect(optionsTarget).toBeTruthy();
        expect(matcher(optionsTarget)).toBe(true);

        // The legacy in-panel dialog must NOT appear in the sidepanel.
        const modalInPanel = await page.$('.modal-overlay');
        expect(modalInPanel).toBeNull();

        // Clean up: close any options tab(s) so they don't leak into other
        // assertions. openOptionsPage() reuses an existing tab, but close every
        // matching target defensively.
        try {
            const optionTargets = (await browser.targets()).filter(matcher);
            for (const t of optionTargets) {
                const optPage = await t.page();
                if (optPage) await optPage.close();
            }
        } catch (_) { /* target may already be detached */ }
    }, 30000);
});
