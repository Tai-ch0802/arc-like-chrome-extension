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
});
