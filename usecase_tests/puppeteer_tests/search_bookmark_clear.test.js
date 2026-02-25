const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Bookmark Search Clear', () => {
    let browser, page;
    let testBookmarkIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });

        // Create test bookmarks
        const result = await page.evaluate(() => {
            return new Promise(async (resolve) => {
                const folder = await new Promise(r => chrome.bookmarks.create({
                    parentId: '1', title: 'ClearTestFolder'
                }, r));
                const bm1 = await new Promise(r => chrome.bookmarks.create({
                    parentId: folder.id, title: 'ClearTestAlpha', url: 'https://clear-alpha.example.com'
                }, r));
                const bm2 = await new Promise(r => chrome.bookmarks.create({
                    parentId: folder.id, title: 'ClearTestBeta', url: 'https://clear-beta.example.com'
                }, r));
                const bm3 = await new Promise(r => chrome.bookmarks.create({
                    parentId: '1', title: 'ClearTestGamma', url: 'https://clear-gamma.example.com'
                }, r));
                resolve({ folderId: folder.id, bm1Id: bm1.id, bm2Id: bm2.id, bm3Id: bm3.id });
            });
        });
        testBookmarkIds = [result.folderId, result.bm3Id];

        // Expand bookmarks bar first (root folder is collapsed by default)
        await expandBookmarksBar(page);
        await new Promise(r => setTimeout(r, 500));

        // Wait for test folder and expand it
        await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${result.folderId}"]`, { timeout: 10000 });
        await page.click(`.bookmark-folder[data-bookmark-id="${result.folderId}"]`);
        await page.waitForFunction(
            (id) => {
                const folder = document.querySelector(`.bookmark-folder[data-bookmark-id="${id}"]`);
                return folder && folder.getAttribute('aria-expanded') === 'true';
            },
            { timeout: 5000 },
            result.folderId
        );
    }, 30000);

    afterAll(async () => {
        // Cleanup test bookmarks
        if (page) {
            await page.evaluate((ids) => {
                return Promise.all(ids.map(id =>
                    new Promise(r => {
                        try { chrome.bookmarks.removeTree(id, r); }
                        catch { chrome.bookmarks.remove(id, r); }
                    })
                ));
            }, testBookmarkIds);
        }
        await teardownBrowser(browser);
    });

    it('should restore full bookmark list after clearing search via clear button', async () => {
        // Get initial bookmark count
        const initialCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(initialCount).toBeGreaterThanOrEqual(3);

        // Search for a specific bookmark
        await page.type('#search-box', 'ClearTestAlpha');
        await new Promise(r => setTimeout(r, 500));

        // Verify filtered state
        const filteredCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(filteredCount).toBe(1);

        // Click clear button
        await page.click('#clear-search-btn');
        await new Promise(r => setTimeout(r, 1500));

        // Verify bookmarks are restored
        const restoredCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(restoredCount).toBeGreaterThanOrEqual(initialCount);

        // Verify no highlights remain
        const highlights = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list mark').length
        );
        expect(highlights).toBe(0);
    });

    it('should handle rapid search-then-clear without stale results (race condition guard)', async () => {
        // Get initial bookmark state
        const initialCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(initialCount).toBeGreaterThanOrEqual(3);

        // Simulate the race condition: type search and immediately clear
        // This can cause filterBookmarks(["query"]) to be still awaiting
        // while filterBookmarks([]) fires and triggers refreshBookmarksRequired
        await page.evaluate(() => {
            const searchBox = document.getElementById('search-box');
            // Start a search
            searchBox.value = 'ClearTestAlpha';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Immediately clear (simulating fast user who types then clears within debounce window)
        await new Promise(r => setTimeout(r, 50));
        await page.evaluate(() => {
            const searchBox = document.getElementById('search-box');
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Wait for all async operations to settle
        await new Promise(r => setTimeout(r, 2000));

        // The full bookmark list should be restored, NOT stuck in filtered state
        const finalCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(finalCount).toBeGreaterThanOrEqual(initialCount);

        // Verify search box is empty
        const searchValue = await page.$eval('#search-box', el => el.value);
        expect(searchValue).toBe('');

        // Verify no highlights remain
        const highlights = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list mark').length
        );
        expect(highlights).toBe(0);
    });

    it('should handle concurrent handleSearch calls with different keywords', async () => {
        // Get initial state
        const initialCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );

        // Simulate multiple rapid searches followed by clear
        // This triggers multiple concurrent handleSearch → filterBookmarks calls
        for (const query of ['ClearTest', 'ClearTestAlph', 'ClearTestAlpha', '']) {
            await page.evaluate((q) => {
                const searchBox = document.getElementById('search-box');
                searchBox.value = q;
                searchBox.dispatchEvent(new Event('input', { bubbles: true }));
            }, query);
            await new Promise(r => setTimeout(r, 30)); // tiny gap between each
        }

        // Wait for all async operations to settle
        await new Promise(r => setTimeout(r, 2000));

        // Bookmarks should be fully restored
        const finalCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(finalCount).toBeGreaterThanOrEqual(initialCount);

        const searchValue = await page.$eval('#search-box', el => el.value);
        expect(searchValue).toBe('');
    });
});
