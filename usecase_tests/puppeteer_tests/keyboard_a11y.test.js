
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Keyboard Accessibility', () => {
    let browser;
    let page;
    let createdTabIdForCleanup = null;

    beforeAll(async () => {
        ({ browser, page } = await setupBrowser());
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    afterEach(async () => {
        // Cleanup any tabs created during tests
        if (createdTabIdForCleanup) {
            await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.tabs.get(id, (tab) => {
                        if (chrome.runtime.lastError || !tab) return resolve();
                        chrome.tabs.remove(id, resolve);
                    });
                });
            }, createdTabIdForCleanup).catch(() => { });
            createdTabIdForCleanup = null;
        }
    });

    test('Tabs should be keyboard focusable (tabindex="0")', async () => {
        // Wait for tabs to render
        await page.waitForSelector('.tab-item');

        const tabs = await page.$$('.tab-item');
        expect(tabs.length).toBeGreaterThan(0);

        // Check the first tab for tabindex
        const tabindex = await page.evaluate(el => el.getAttribute('tabindex'), tabs[0]);
        expect(tabindex).toBe('0');
    });

    test('Tabs should have aria-selected attribute', async () => {
        await page.waitForSelector('.tab-item.active');
        const activeTab = await page.$('.tab-item.active');
        const ariaSelected = await page.evaluate(el => el.getAttribute('aria-selected'), activeTab);
        expect(ariaSelected).toBe('true');
    });

    test('Window folders should be keyboard focusable and have ARIA attributes', async () => {
        const folders = await page.$$('.window-folder');
        if (folders.length > 0) {
            const tabindex = await page.evaluate(el => el.getAttribute('tabindex'), folders[0]);
            expect(tabindex).toBe('0');

            const role = await page.evaluate(el => el.getAttribute('role'), folders[0]);
            expect(role).toBe('button');

            const ariaExpanded = await page.evaluate(el => el.getAttribute('aria-expanded'), folders[0]);
            expect(ariaExpanded).not.toBeNull();
        }
    });

    test('Pressing Enter on child buttons should NOT activate tab or folder', async () => {
        // Create a dummy tab to close safely
        const dummyUrl = 'http://example.com/';
        const createdTab = await page.evaluate((url) => {
            return new Promise(resolve => {
                chrome.tabs.create({ url: url, active: false }, (tab) => resolve(tab));
            });
        }, dummyUrl);

        // Note: this tab will be closed by the test itself (via Enter on close button),
        // so we don't need afterEach cleanup for it. But set it just in case.
        createdTabIdForCleanup = createdTab.id;

        // Wait for it to appear
        const tabSelector = `.tab-item[data-url*="example.com"]`;
        await page.waitForSelector(tabSelector, { timeout: 5000 });

        const initialTabCount = await page.$$eval('.tab-item', tabs => tabs.length);

        // Find the close button of this specific tab
        const closeBtnSelector = `${tabSelector} .close-btn`;
        await page.waitForSelector(closeBtnSelector);

        // Focus it using evaluate to ensure we target the specific element
        await page.$eval(closeBtnSelector, el => el.focus());

        // Ensure it is focused
        const isFocused = await page.$eval(closeBtnSelector, el => document.activeElement === el);
        expect(isFocused).toBe(true);

        // Press Enter
        await page.keyboard.press('Enter');

        // Wait for the tab to disappear
        await page.waitForFunction((count) => {
            return document.querySelectorAll('.tab-item').length === count - 1;
        }, { timeout: 10000 }, initialTabCount);

        const finalTabCount = await page.$$eval('.tab-item', tabs => tabs.length);
        expect(finalTabCount).toBe(initialTabCount - 1);

        // Tab was closed by the test, clear cleanup reference
        createdTabIdForCleanup = null;
    }, 30000);

    test('should navigate between tabs using Arrow Up/Down keys', async () => {
        // Ensure we have at least 2 tabs
        const tabCount = await page.$$eval('.tab-item', tabs => tabs.length);
        if (tabCount < 2) {
            const newTab = await page.evaluate(() => {
                return new Promise(r => chrome.tabs.create({ url: 'about:blank' }, (tab) => r(tab)));
            });
            createdTabIdForCleanup = newTab.id;
            await page.waitForFunction(() => document.querySelectorAll('.tab-item').length >= 2, { timeout: 10000 });
        }

        // Get handles to first two tabs
        const tabs = await page.$$('.tab-item');
        const tab1Id = await tabs[0].evaluate(el => el.dataset.tabId);
        const tab2Id = await tabs[1].evaluate(el => el.dataset.tabId);

        // Focus the first tab
        await tabs[0].focus();

        // Verify focus — use optional chaining to guard against null activeElement
        let focusedId = await page.evaluate(() => document.activeElement?.dataset?.tabId ?? null);
        expect(focusedId).toBe(tab1Id);

        // Press Arrow Down
        await page.keyboard.press('ArrowDown');

        // Verify focus moved to second tab
        focusedId = await page.evaluate(() => document.activeElement?.dataset?.tabId ?? null);
        expect(focusedId).toBe(tab2Id);

        // Press Arrow Up
        await page.keyboard.press('ArrowUp');

        // Verify focus moved back to first tab
        focusedId = await page.evaluate(() => document.activeElement?.dataset?.tabId ?? null);
        expect(focusedId).toBe(tab1Id);
    }, 30000);
});
