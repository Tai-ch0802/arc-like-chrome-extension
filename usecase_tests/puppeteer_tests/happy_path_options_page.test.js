const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * The settings UI now lives in a dedicated options page (options.html), opened
 * via chrome.runtime.openOptionsPage(). This suite navigates directly to the
 * options page and verifies:
 *   1. The left nav renders 8 items, with the first section (appearance) active.
 *   2. Clicking the "features" nav item activates the features section.
 *   3. Toggling a feature checkbox persists the value to chrome.storage.sync.
 */
describe('Options Page Use Case', () => {
    let browser;
    let page;
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;

        const optionsUrl = `chrome-extension://${extensionId}/options.html`;
        await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' });

        // Nav is built on DOMContentLoaded.
        await page.waitForSelector('.opt-nav__item', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('left nav renders 8 sections with appearance active by default', async () => {
        const navItems = await page.$$('.opt-nav__item');
        expect(navItems.length).toBe(9); // +快訊(newswire, BASE-016 N2)

        // The appearance section is active on load.
        await page.waitForSelector('.opt-section.active', { timeout: 5000 });
        const activeSection = await page.$eval(
            '.opt-section.active',
            el => el.dataset.section
        );
        expect(activeSection).toBe('appearance');

        // The corresponding nav item is also active.
        const activeNav = await page.$eval(
            '.opt-nav__item.active',
            el => el.dataset.section
        );
        expect(activeNav).toBe('appearance');
    }, 30000);

    test('clicking the features nav item activates the features section', async () => {
        await page.click('.opt-nav__item[data-section="features"]');

        await page.waitForFunction(
            () => document.querySelector('.opt-section.active')?.dataset.section === 'features',
            { timeout: 5000 }
        );

        const activeSection = await page.$eval(
            '.opt-section.active',
            el => el.dataset.section
        );
        expect(activeSection).toBe('features');

        // The reading-list visibility toggle should be present in this section.
        const checkbox = await page.$('#feat-toggle-readingListVisible');
        expect(checkbox).not.toBeNull();
    }, 30000);

    test('toggling a feature checkbox persists to chrome.storage.sync', async () => {
        // Ensure we are on the features section.
        await page.click('.opt-nav__item[data-section="features"]');
        await page.waitForFunction(
            () => document.querySelector('.opt-section.active')?.dataset.section === 'features',
            { timeout: 5000 }
        );

        const toggleSel = '#feat-toggle-readingListVisible';
        await page.waitForSelector(toggleSel, { timeout: 5000 });

        // Read the current checkbox state, then toggle to the opposite value.
        const initialChecked = await page.$eval(toggleSel, el => el.checked);
        const expectedValue = !initialChecked;

        await page.click(toggleSel);

        // The change handler writes to chrome.storage.sync asynchronously.
        await page.waitForFunction(
            (expected) => new Promise(resolve => {
                chrome.storage.sync.get({ readingListVisible: true }, (res) => {
                    resolve(res.readingListVisible === expected);
                });
            }),
            { timeout: 5000 },
            expectedValue
        );

        const persisted = await page.evaluate(() => new Promise(resolve => {
            chrome.storage.sync.get({ readingListVisible: true }, (res) => {
                resolve(res.readingListVisible);
            });
        }));
        expect(persisted).toBe(expectedValue);

        // The checkbox UI reflects the new value.
        const uiChecked = await page.$eval(toggleSel, el => el.checked);
        expect(uiChecked).toBe(expectedValue);
    }, 30000);
});
