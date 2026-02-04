const { setupBrowser, teardownBrowser, expandBookmarksBar, waitForTextContent } = require('./setup');

describe('Bookmark Folder Toggle Use Case', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        // Close the initial page, we'll create fresh ones per test
        await setup.page.close();
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should expand a collapsed folder when clicking on it', async () => {
        // Create a fresh page
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#bookmark-list');

        // Create a test folder with a bookmark inside
        const folder = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Test Folder Toggle'
                }, resolve);
            });
        });
        const testFolderId = folder.id;

        // Create a bookmark inside the folder
        const bookmark = await page.evaluate((folderId) => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: folderId,
                    title: 'Test Bookmark Inside',
                    url: 'https://example.com/inside-folder'
                }, resolve);
            });
        }, testFolderId);
        const testBookmarkId = bookmark.id;

        try {
            // Reload and expand Bookmarks Bar first
            await page.reload();
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId}"]`);

            // The test folder should be collapsed by default
            const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;

            // Check if folder is collapsed (icon shows ▶)
            const isCollapsed = await page.$eval(folderSelector, el => {
                const icon = el.querySelector('.bookmark-icon');
                return icon && icon.textContent.includes('▶');
            });
            expect(isCollapsed).toBe(true);

            // Click on the folder to expand it
            await page.click(folderSelector);

            // Wait for folder icon to change to expanded state (▼)
            await waitForTextContent(page, `${folderSelector} .bookmark-icon`, '▼');

            // Verify folder is now expanded (icon shows ▼)
            const isExpanded = await page.$eval(folderSelector, el => {
                const icon = el.querySelector('.bookmark-icon');
                return icon && icon.textContent.includes('▼');
            });
            expect(isExpanded).toBe(true);

            // Verify the bookmark inside is now visible
            const bookmarkVisible = await page.$(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`);
            expect(bookmarkVisible).not.toBeNull();
        } finally {
            // Cleanup
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.removeTree(id, resolve);
                    });
                }, testFolderId);
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should collapse an expanded folder when clicking on it', async () => {
        // Create a fresh page
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#bookmark-list');

        // Create a test folder with a bookmark inside
        const folder = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Test Folder Collapse'
                }, resolve);
            });
        });
        const testFolderId = folder.id;

        const bookmark = await page.evaluate((folderId) => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: folderId,
                    title: 'Test Inner Bookmark',
                    url: 'https://example.com/inner'
                }, resolve);
            });
        }, testFolderId);
        const testBookmarkId = bookmark.id;

        try {
            // Reload and expand Bookmarks Bar
            await page.reload();
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId}"]`);

            const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;

            // First expand the folder
            await page.click(folderSelector);

            // Wait for folder icon to change to expanded state (▼)
            await waitForTextContent(page, `${folderSelector} .bookmark-icon`, '▼');

            // Verify it's expanded
            const isExpanded = await page.$eval(folderSelector, el => {
                const icon = el.querySelector('.bookmark-icon');
                return icon && icon.textContent.includes('▼');
            });
            expect(isExpanded).toBe(true);

            // Now click to collapse
            await page.click(folderSelector);

            // Wait for folder icon to change to collapsed state (▶)
            await waitForTextContent(page, `${folderSelector} .bookmark-icon`, '▶');

            // Verify it's collapsed
            const isCollapsed = await page.$eval(folderSelector, el => {
                const icon = el.querySelector('.bookmark-icon');
                return icon && icon.textContent.includes('▶');
            });
            expect(isCollapsed).toBe(true);
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.removeTree(id, resolve);
                    });
                }, testFolderId);
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);
}, 180000);
