const { setupBrowser, teardownBrowser } = require('./setup');

describe('Search Edge Cases', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        // Wait for initial app load
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        if (browser) {
            await teardownBrowser(browser);
        }
    });

    /**
     * Helper: clear the search box and trigger input event to reset search state
     */
    async function clearSearch() {
        await page.evaluate(() => {
            const searchBox = document.getElementById('search-box');
            if (searchBox) {
                searchBox.value = '';
                searchBox.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        // Wait for all items to be visible again
        await page.waitForFunction(() => {
            const hidden = document.querySelectorAll('.tab-item.hidden');
            return hidden.length === 0;
        }, { timeout: 15000 }).catch(() => { });
    }

    afterEach(async () => {
        await clearSearch();
    });

    // NOTE: literal substring matching of special / regex metacharacters (e.g. "<test>",
    // "(Special)", "[Chars]") is now covered deterministically by unit tests in
    // unit_tests/searchUtils.test.mjs ("literal (non-regex) matching"). Those two former
    // E2E cases only re-proved matchesAnyKeyword through a browser round-trip, so they were
    // removed here. The cases below remain E2E because they genuinely need the browser:
    // XSS-in-DOM safety, the no-results UI state, robustness under pathological input, and
    // the live debounce+render race.
    test('should handle XSS attempts safely', async () => {
        let dialogShown = false;
        const dialogHandler = async dialog => {
            dialogShown = true;
            await dialog.dismiss();
        };
        page.on('dialog', dialogHandler);

        try {
            const xssInput = '<script>alert("XSS")</script>';
            await page.type('#search-box', xssInput);
            // Wait for search to process
            await page.waitForFunction(
                () => {
                    const el = document.getElementById('no-search-results');
                    return el && !el.classList.contains('hidden');
                },
                { timeout: 15000 }
            );

            expect(dialogShown).toBe(false);

            // Verify input value remains
            const val = await page.$eval('#search-box', el => el.value);
            expect(val).toBe(xssInput);

            // Verify no results
            const isVisible = await page.$eval('#no-search-results', el => !el.classList.contains('hidden'));
            expect(isVisible).toBe(true);

        } finally {
            page.off('dialog', dialogHandler);
        }
    }, 30000);

    test('should handle very long input without crashing', async () => {
        const longString = 'a'.repeat(500);
        await page.type('#search-box', longString);
        // Wait for search to process
        await page.waitForFunction(
            () => {
                const el = document.getElementById('no-search-results');
                return el && !el.classList.contains('hidden');
            },
            { timeout: 10000 }
        );

        // Verify UI is still responsive
        const searchBox = await page.$('#search-box');
        expect(searchBox).not.toBeNull();

        const isVisible = await page.$eval('#no-search-results', el => !el.classList.contains('hidden'));
        expect(isVisible).toBe(true);
    }, 30000);

    test('should show no results state for non-matching query', async () => {
        const query = 'nonExistentStringXYZ123';
        await page.type('#search-box', query);
        // Wait for no-results to appear
        await page.waitForFunction(
            () => {
                const el = document.getElementById('no-search-results');
                return el && !el.classList.contains('hidden');
            },
            { timeout: 15000 }
        );

        const isVisible = await page.$eval('#no-search-results', el => !el.classList.contains('hidden'));
        expect(isVisible).toBe(true);

        const isContentHidden = await page.$eval('#content-container', el => el.classList.contains('hidden'));
        expect(isContentHidden).toBe(true);
    }, 30000);

    test('should handle rapid input updates correctly (race condition check)', async () => {
        let createdTabIds = [];
        try {
            // Create tabs with specific titles
            const ids = await page.evaluate(async () => {
                const t1 = await new Promise(r => chrome.tabs.create({ url: 'data:text/html,<title>search-race-1</title>', active: false }, r));
                const t2 = await new Promise(r => chrome.tabs.create({ url: 'data:text/html,<title>search-race-2</title>', active: false }, r));
                return [t1.id, t2.id];
            });
            createdTabIds = ids;

            // Wait for tabs to render
            await page.waitForFunction(
                (ids) => ids.every(id => document.querySelector(`.tab-item[data-tab-id="${id}"]`)),
                { timeout: 10000 },
                createdTabIds
            );

            const input = '#search-box';

            // Type common prefix -> matches both
            await page.type(input, 'search-race');

            // Wait for 2 visible tabs
            await page.waitForFunction((ids) => {
                const t1 = document.querySelector(`.tab-item[data-tab-id="${ids[0]}"]`);
                const t2 = document.querySelector(`.tab-item[data-tab-id="${ids[1]}"]`);
                return t1 && !t1.classList.contains('hidden') && t2 && !t2.classList.contains('hidden');
            }, { timeout: 15000 }, createdTabIds);

            // Type specific suffix for first tab
            await page.type(input, '-1');

            // Wait for 1 visible tab (Tab 1)
            await page.waitForFunction((ids) => {
                const t1 = document.querySelector(`.tab-item[data-tab-id="${ids[0]}"]`);
                const t2 = document.querySelector(`.tab-item[data-tab-id="${ids[1]}"]`);
                return t1 && !t1.classList.contains('hidden') && t2 && t2.classList.contains('hidden');
            }, { timeout: 15000 }, createdTabIds);

            // Rapidly change to match second tab: backspace twice and type '-2'
            await page.focus(input);
            await page.keyboard.press('Backspace');
            await page.keyboard.press('Backspace');
            await page.type(input, '-2');

            // Wait for results to settle to Tab 2
            await page.waitForFunction((ids) => {
                const t1 = document.querySelector(`.tab-item[data-tab-id="${ids[0]}"]`);
                const t2 = document.querySelector(`.tab-item[data-tab-id="${ids[1]}"]`);
                return t1 && t1.classList.contains('hidden') && t2 && !t2.classList.contains('hidden');
            }, { timeout: 15000 }, createdTabIds);

            expect(true).toBe(true);

        } finally {
            if (createdTabIds.length > 0) {
                try {
                    await page.evaluate((ids) => chrome.tabs.remove(ids), createdTabIds);
                } catch (e) { }
            }
        }
    }, 30000);
});
