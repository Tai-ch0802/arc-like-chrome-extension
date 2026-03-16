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
            const newTab = await page.evaluate((index) => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: `https://example.com/scroll-test-${index}`,
                        active: false
                    }, resolve);
                });
            }, i);
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
        const initialScrollTop = await page.evaluate(
            () => document.documentElement.scrollTop || document.body.scrollTop
        );

        // Scroll to bottom
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 300));

        const scrollTopAfterScroll = await page.evaluate(
            () => document.documentElement.scrollTop || document.body.scrollTop
        );
        expect(scrollTopAfterScroll).toBeGreaterThan(initialScrollTop);

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

        // Click it
        const targetSelector = `.tab-item[data-tab-id="${targetTabId}"]`;
        await page.click(targetSelector);
        await waitForClass(page, targetSelector, 'active');
        await new Promise(r => setTimeout(r, 500));

        // Scroll should NOT have jumped back
        const scrollTopAfterClick = await page.evaluate(
            () => document.documentElement.scrollTop || document.body.scrollTop
        );
        const scrollDrift = Math.abs(scrollTopAfterClick - scrollTopAfterScroll);
        expect(scrollDrift).toBeLessThan(200);
        expect(scrollTopAfterClick).toBeGreaterThan(scrollTopAfterScroll * 0.5);
    }, 60000);

    test('keyboard arrow navigation should still auto-scroll', async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 200));

        const firstTab = await page.$('.tab-item');
        expect(firstTab).not.toBeNull();
        await firstTab.focus();

        for (let i = 0; i < 15; i++) {
            await page.keyboard.press('ArrowDown');
            await new Promise(r => setTimeout(r, 50));
        }
        await new Promise(r => setTimeout(r, 500));

        const scrollTop = await page.evaluate(
            () => document.documentElement.scrollTop || document.body.scrollTop
        );
        expect(scrollTop).toBeGreaterThan(0);
    }, 60000);
});
