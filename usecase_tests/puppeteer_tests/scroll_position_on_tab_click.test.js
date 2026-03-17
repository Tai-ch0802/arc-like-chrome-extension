/**
 * Regression test for scroll-jump-on-tab-click bug.
 *
 * Bug: When the side panel has many tabs requiring scroll, clicking a
 * non-active tab after scrolling causes the scroll to jump back to the
 * active tab's position.
 *
 * Root cause: focusin handler unconditionally called scrollIntoView().
 * Fix: Guard scrollIntoView with a lastInputWasKeyboard flag.
 */
const { setupBrowser, teardownBrowser, waitForTabCount, waitForClass } = require('./setup');

const TAB_COUNT = 30;
const KEYPRESS_INTERVAL_MS = 50;

describe('Scroll Position Stability on Tab Click', () => {
    let browser;
    let page;
    let sidePanelUrl;
    const createdTabIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        sidePanelUrl = setup.sidePanelUrl;
        await page.waitForSelector('#tab-list', { timeout: 15000 });

        for (let i = 0; i < TAB_COUNT; i++) {
            const newTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: 'about:blank',
                        active: false
                    }, resolve);
                });
            });
            createdTabIds.push(newTab.id);
        }

        await page.waitForFunction(
            (count) => new Promise(resolve => {
                chrome.tabs.query({}, tabs => resolve(tabs.length >= count));
            }),
            { timeout: 30000 },
            TAB_COUNT
        );

        await page.goto(sidePanelUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await waitForTabCount(page, TAB_COUNT);
    }, 180000);

    afterAll(async () => {
        try {
            if (createdTabIds.length > 0) {
                await page.evaluate((ids) => new Promise(resolve => {
                    chrome.tabs.remove(ids, resolve);
                }), createdTabIds);
            }
        } catch (e) { }
        await teardownBrowser(browser);
    });

    test('scroll position should NOT jump back after clicking a bottom tab', async () => {
        // Scroll to bottom
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(
            () => (document.documentElement.scrollTop || document.body.scrollTop) > 0,
            { timeout: 5000 }
        );

        const scrollTopAfterScroll = await page.evaluate(
            () => document.documentElement.scrollTop || document.body.scrollTop
        );

        // Find a non-active tab near the bottom
        const targetTabId = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.tab-item'));
            for (let i = items.length - 1; i >= 0; i--) {
                if (!items[i].classList.contains('active')) {
                    return items[i].dataset.tabId;
                }
            }
            return null;
        });
        expect(targetTabId).not.toBeNull();

        // Click the target tab and wait for it to become active
        const targetSelector = `.tab-item[data-tab-id="${targetTabId}"]`;
        await page.click(targetSelector);
        await waitForClass(page, targetSelector, 'active');

        // Wait for any async scroll effects to settle
        await page.waitForFunction(
            (prevScroll) => {
                const current = document.documentElement.scrollTop || document.body.scrollTop;
                // Scroll position should remain in the same ballpark
                return Math.abs(current - prevScroll) < prevScroll * 0.3;
            },
            { timeout: 5000 },
            scrollTopAfterScroll
        );

        // Scroll should NOT have jumped back significantly
        const scrollTopAfterClick = await page.evaluate(
            () => document.documentElement.scrollTop || document.body.scrollTop
        );
        const scrollDrift = Math.abs(scrollTopAfterClick - scrollTopAfterScroll);
        // Use proportional tolerance: drift should be less than 30% of scroll position
        expect(scrollDrift).toBeLessThan(scrollTopAfterScroll * 0.3);
    }, 60000);

    test('keyboard Tab navigation should still auto-scroll focused tab into view', async () => {
        // Scroll back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(
            () => (document.documentElement.scrollTop || document.body.scrollTop) === 0,
            { timeout: 5000 }
        );

        const firstTab = await page.$('.tab-item');
        expect(firstTab).not.toBeNull();
        await firstTab.focus();

        // Tab key moves focus between focusable elements, triggering focusin on each.
        // The focusin handler calls scrollIntoView when lastInputWasKeyboard is true.
        // (ArrowDown does NOT move focus between div[tabIndex=0] elements.)
        for (let i = 0; i < 15; i++) {
            await page.keyboard.press('Tab');
            await new Promise(r => setTimeout(r, KEYPRESS_INTERVAL_MS));
        }

        // The focused element should now be well below the initial viewport.
        // Verify that scrollIntoView was called by checking either:
        // (a) document scroll position increased, or
        // (b) the focused element is within the visible viewport (scrolled into view)
        const result = await page.evaluate(() => {
            const focused = document.activeElement;
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const rect = focused ? focused.getBoundingClientRect() : null;
            return { scrollTop, focusedTop: rect ? rect.top : null };
        });

        // At least one of these should be true after 15 Tab presses through 30 tabs:
        // - The page scrolled down
        // - The focused element is visible in the viewport
        const pageScrolled = result.scrollTop > 0;
        const focusedIsVisible = result.focusedTop !== null
            && result.focusedTop >= 0
            && result.focusedTop < 800; // viewport height
        expect(pageScrolled || focusedIsVisible).toBe(true);
    }, 60000);
});
