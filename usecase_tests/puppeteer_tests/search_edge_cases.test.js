const { setupBrowser, teardownBrowser } = require('./setup');

describe('Search Edge Cases', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        // Close the initial page as per "fresh page per test" pattern
        await setup.page.close();
    }, 30000);

    afterAll(async () => {
        if (browser) {
            await teardownBrowser(browser);
        }
    });

    test('should find tabs with special characters', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        let createdTabId;

        try {
            // Create a tab with special characters in the title using a data URL
            const title = 'Special & Characters <test> " \' / \\';
            const url = `data:text/html,<html><head><title>${title}</title></head><body></body></html>`;

            createdTabId = await page.evaluate((u) => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: u, active: false }, (tab) => resolve(tab.id));
                });
            }, url);

            // Wait for tab to appear in list (instead of fixed timeout)
            await page.waitForFunction(
                (id) => document.querySelector(`.tab-item[data-tab-id="${id}"]`),
                { timeout: 10000 },
                createdTabId
            );

            // Search for a unique part of the title
            await page.type('#search-box', '<test>');
            // Wait for search to process (debounce) by checking visibility
            await page.waitForFunction(
                (id) => {
                    const el = document.querySelector(`.tab-item[data-tab-id="${id}"]`);
                    return el && !el.classList.contains('hidden');
                },
                { timeout: 5000 },
                createdTabId
            );

            // Check if the specific tab is visible
            const found = await page.evaluate((id) => {
                const el = document.querySelector(`.tab-item[data-tab-id="${id}"]`);
                return el && !el.classList.contains('hidden');
            }, createdTabId);
            expect(found).toBe(true);

        } finally {
            if (createdTabId) {
                try {
                    await page.evaluate((id) => chrome.tabs.remove(id), createdTabId);
                } catch (e) { }
            }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should find tabs with regex special characters', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        let createdTabId;

        try {
            const title = 'Regex (Special) [Chars] {Block} * + ? . ^ $ |';
            const url = `data:text/html,<html><head><title>${title}</title></head><body></body></html>`;

            createdTabId = await page.evaluate((u) => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: u, active: false }, (tab) => resolve(tab.id));
                });
            }, url);

            // Wait for tab to appear in list
            await page.waitForFunction(
                (id) => document.querySelector(`.tab-item[data-tab-id="${id}"]`),
                { timeout: 10000 },
                createdTabId
            );

            // Search for "(Special)"
            await page.type('#search-box', '(Special)');
            await page.waitForFunction(
                (id) => {
                    const el = document.querySelector(`.tab-item[data-tab-id="${id}"]`);
                    return el && !el.classList.contains('hidden');
                },
                { timeout: 5000 },
                createdTabId
            );

            const found = await page.evaluate((id) => {
                const el = document.querySelector(`.tab-item[data-tab-id="${id}"]`);
                return el && !el.classList.contains('hidden');
            }, createdTabId);
            expect(found).toBe(true);

            // Clear and search for "[Chars]"
            await page.evaluate(() => {
                document.getElementById('search-box').value = '';
            });
            await page.type('#search-box', '[Chars]');
            // Wait for filter to apply
            await page.waitForFunction(
                (id) => {
                    const el = document.querySelector(`.tab-item[data-tab-id="${id}"]`);
                    return el && !el.classList.contains('hidden');
                },
                { timeout: 5000 },
                createdTabId
            );

            const found2 = await page.evaluate((id) => {
                const el = document.querySelector(`.tab-item[data-tab-id="${id}"]`);
                return el && !el.classList.contains('hidden');
            }, createdTabId);
            expect(found2).toBe(true);

        } finally {
            if (createdTabId) {
                try {
                    await page.evaluate((id) => chrome.tabs.remove(id), createdTabId);
                } catch (e) { }
            }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should handle XSS attempts safely', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);

        try {
            let dialogShown = false;
            page.on('dialog', async dialog => {
                dialogShown = true;
                await dialog.dismiss();
            });

            const xssInput = '<script>alert("XSS")</script>';
            await page.type('#search-box', xssInput);
            // Wait for search to process
            await page.waitForFunction(
                () => {
                    const el = document.getElementById('no-search-results');
                    return el && !el.classList.contains('hidden');
                },
                { timeout: 5000 }
            );

            expect(dialogShown).toBe(false);

            // Verify input value remains
            const val = await page.$eval('#search-box', el => el.value);
            expect(val).toBe(xssInput);

            // Verify no results (assuming no tab matches this)
            const noResults = await page.$('#no-search-results');
            const isVisible = await page.evaluate(el => !el.classList.contains('hidden'), noResults);
            expect(isVisible).toBe(true);

        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should handle very long input without crashing', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);

        try {
            const longString = 'a'.repeat(500);
            await page.type('#search-box', longString);
            // Wait for search to process
            await page.waitForFunction(
                () => {
                    const el = document.getElementById('no-search-results');
                    return el && !el.classList.contains('hidden');
                },
                { timeout: 5000 }
            );

            // Verify UI is still responsive
            const searchBox = await page.$('#search-box');
            expect(searchBox).not.toBeNull();

            const noResults = await page.$('#no-search-results');
            const isVisible = await page.evaluate(el => !el.classList.contains('hidden'), noResults);
            expect(isVisible).toBe(true);

        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should show no results state for non-matching query', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);

        try {
            const query = 'nonExistentStringXYZ123';
            await page.type('#search-box', query);
            // Wait for no-results to appear
            await page.waitForFunction(
                () => {
                    const el = document.getElementById('no-search-results');
                    return el && !el.classList.contains('hidden');
                },
                { timeout: 5000 }
            );

            const noResults = await page.$('#no-search-results');
            const isVisible = await page.evaluate(el => !el.classList.contains('hidden'), noResults);
            expect(isVisible).toBe(true);

            const contentContainer = await page.$('#content-container');
            const isContentHidden = await page.evaluate(el => el.classList.contains('hidden'), contentContainer);
            expect(isContentHidden).toBe(true);

        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should handle rapid input updates correctly (race condition check)', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        let createdTabIds = [];
        try {
            // Create tabs with specific titles (since search logic matches title or domain, not full URL path)
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
            }, {}, createdTabIds);

            // Type specific suffix for first tab
            await page.type(input, '-1');

            // Wait for 1 visible tab (Tab 1)
            await page.waitForFunction((ids) => {
                 const t1 = document.querySelector(`.tab-item[data-tab-id="${ids[0]}"]`);
                 const t2 = document.querySelector(`.tab-item[data-tab-id="${ids[1]}"]`);
                 return t1 && !t1.classList.contains('hidden') && t2 && t2.classList.contains('hidden');
            }, {}, createdTabIds);

            // Rapidly change to match second tab: backspace twice and type '-2'
            // We use keyboard press for speed
            await page.focus(input);
            await page.keyboard.press('Backspace');
            await page.keyboard.press('Backspace');
            await page.type(input, '-2');

            // Debug: Check input value
            const finalValue = await page.$eval(input, el => el.value);
            if (finalValue !== 'search-race-2') {
                console.log('Search value mismatch:', finalValue);
            }

            // Wait for results to settle to Tab 2
            try {
                await page.waitForFunction((ids) => {
                     const t1 = document.querySelector(`.tab-item[data-tab-id="${ids[0]}"]`);
                     const t2 = document.querySelector(`.tab-item[data-tab-id="${ids[1]}"]`);
                     // Tab 1 hidden, Tab 2 visible
                     return t1 && t1.classList.contains('hidden') && t2 && !t2.classList.contains('hidden');
                }, { timeout: 5000 }, createdTabIds);
            } catch (e) {
                // Debug failure
                const t1Hidden = await page.$eval(`.tab-item[data-tab-id="${createdTabIds[0]}"]`, el => el.classList.contains('hidden'));
                const t2Hidden = await page.$eval(`.tab-item[data-tab-id="${createdTabIds[1]}"]`, el => el.classList.contains('hidden'));
                console.log('T1 hidden:', t1Hidden);
                console.log('T2 hidden:', t2Hidden);
                throw e;
            }

            // Assertion is implicit in waitForFunction success
            expect(true).toBe(true);

        } finally {
            if (createdTabIds.length > 0) {
                 try {
                    await page.evaluate((ids) => chrome.tabs.remove(ids), createdTabIds);
                } catch (e) { }
            }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);
});
