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

        // Expand bookmarks bar first (root folder is collapsed by default).
        // expandBookmarksBar already waits for the expanded state; the folder
        // selector below gates on the children rendering, so no fixed delay needed.
        await expandBookmarksBar(page);

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

        // Search for a specific bookmark; wait for the list to settle to exactly 1 match
        await page.type('#search-box', 'ClearTestAlpha');
        await page.waitForFunction(
            () => document.querySelectorAll('#bookmark-list .bookmark-item').length === 1,
            { timeout: 5000 }
        );

        // Verify filtered state
        const filteredCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(filteredCount).toBe(1);

        // Click clear button; wait until the full list is restored with the search box
        // emptied and no stale highlights — deterministic regardless of debounce timing.
        await page.click('#clear-search-btn');
        await page.waitForFunction(
            (min) => document.querySelectorAll('#bookmark-list .bookmark-item').length >= min
                && document.getElementById('search-box').value === ''
                && document.querySelectorAll('#bookmark-list mark').length === 0,
            { timeout: 5000 },
            initialCount
        );

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

        // Immediately clear (simulating fast user who types then clears within debounce
        // window). The 50ms gap is the intentional race STIMULUS (it reproduces the
        // type-then-clear timing), not an assertion gate — assertions wait on state below.
        await new Promise(r => setTimeout(r, 50));
        await page.evaluate(() => {
            const searchBox = document.getElementById('search-box');
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Wait for the post-clear state to settle deterministically: full list restored,
        // search box empty, and no stale highlights — NOT stuck in the filtered state.
        await page.waitForFunction(
            (min) => document.querySelectorAll('#bookmark-list .bookmark-item').length >= min
                && document.getElementById('search-box').value === ''
                && document.querySelectorAll('#bookmark-list mark').length === 0,
            { timeout: 5000 },
            initialCount
        );

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
            await new Promise(r => setTimeout(r, 30)); // tiny stimulus gap between each rapid keystroke
        }

        // Wait until the rapid-fire concurrent searches settle back to the cleared
        // full-list state (last query is ''), deterministically rather than on a timer.
        await page.waitForFunction(
            (min) => document.querySelectorAll('#bookmark-list .bookmark-item').length >= min
                && document.getElementById('search-box').value === '',
            { timeout: 5000 },
            initialCount
        );

        // Bookmarks should be fully restored
        const finalCount = await page.evaluate(() =>
            document.querySelectorAll('#bookmark-list .bookmark-item').length
        );
        expect(finalCount).toBeGreaterThanOrEqual(initialCount);

        const searchValue = await page.$eval('#search-box', el => el.value);
        expect(searchValue).toBe('');
    });

    it('clearing search leaves no stale highlights in a COLLAPSED folder (regression)', async () => {
        const folderId = testBookmarkIds[0];
        const folderSel = `.bookmark-folder[data-bookmark-id="${folderId}"]`;
        const isCollapsed = (sel) => {
            const f = document.querySelector(sel);
            return f && f.getAttribute('aria-expanded') === 'false';
        };

        // Ensure the folder is COLLAPSED before searching (beforeAll expanded it).
        await page.evaluate((sel) => {
            const f = document.querySelector(sel);
            if (f && f.getAttribute('aria-expanded') === 'true') f.click();
        }, folderSel);
        await page.waitForFunction(isCollapsed, { timeout: 5000 }, folderSel);

        // Search for a bookmark INSIDE the collapsed folder: forceExpandAll renders it
        // with <mark> highlights into the folder's (otherwise collapsed) cached content.
        await page.type('#search-box', 'ClearTestBeta');
        await page.waitForFunction(
            () => document.querySelectorAll('#bookmark-list mark').length > 0,
            { timeout: 5000 }
        );

        // Clear the search; the folder should return to its collapsed state.
        await page.click('#clear-search-btn');
        await page.waitForFunction(isCollapsed, { timeout: 5000 }, folderSel);

        // Re-expand the folder: with the fix, stale highlighted children are purged on
        // clear so this lazy-loads fresh, mark-free rows. Without the fix, the stale
        // <mark> rows resurface here.
        await page.click(folderSel);
        // Wait for the folder to expand AND its children to lazy-render before asserting,
        // so "no marks" reflects freshly rendered rows rather than a not-yet-populated folder.
        // ClearTestBeta lives only inside this folder, so it gates on the folder's own children
        // (ClearTestGamma sits at the root and would otherwise match prematurely).
        await page.waitForFunction(
            (sel) => {
                const f = document.querySelector(sel);
                if (!f || f.getAttribute('aria-expanded') !== 'true') return false;
                return [...document.querySelectorAll('#bookmark-list .bookmark-item')]
                    .some(el => el.textContent.includes('ClearTestBeta'));
            },
            { timeout: 5000 }, folderSel
        );
        const highlights = await page.evaluate(() => document.querySelectorAll('#bookmark-list mark').length);
        expect(highlights).toBe(0);
    });
});
