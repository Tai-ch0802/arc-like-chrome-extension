const { setupBrowser, teardownBrowser, expandBookmarksBar, waitForTextContent } = require('./setup');

describe('Bookmark Folder Toggle Use Case', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should expand a collapsed folder when clicking on it', async () => {
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
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId}"]`, { timeout: 10000 });

            const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;

            const isCollapsed = await page.$eval(folderSelector, el => {
                const icon = el.querySelector('.bookmark-icon');
                return icon && icon.textContent.includes('▶');
            });
            expect(isCollapsed).toBe(true);

            await page.click(folderSelector);

            await waitForTextContent(page, `${folderSelector} .bookmark-icon`, '▼');

            const isExpanded = await page.$eval(folderSelector, el => {
                const icon = el.querySelector('.bookmark-icon');
                return icon && icon.textContent.includes('▼');
            });
            expect(isExpanded).toBe(true);

            const bookmarkVisible = await page.$(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`);
            expect(bookmarkVisible).not.toBeNull();
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.removeTree(id, resolve);
                    });
                }, testFolderId);
            } catch (e) { }
        }
    }, 120000);

    test('should collapse an expanded folder when clicking on it', async () => {
        const folder = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Test Folder Collapse'
                }, resolve);
            });
        });
        const testFolderId = folder.id;

        await page.evaluate((folderId) => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: folderId,
                    title: 'Test Inner Bookmark',
                    url: 'https://example.com/inner'
                }, resolve);
            });
        }, testFolderId);

        try {
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId}"]`, { timeout: 10000 });

            const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;

            // First expand the folder
            await page.click(folderSelector);
            await waitForTextContent(page, `${folderSelector} .bookmark-icon`, '▼');

            const isExpanded = await page.$eval(folderSelector, el => {
                const icon = el.querySelector('.bookmark-icon');
                return icon && icon.textContent.includes('▼');
            });
            expect(isExpanded).toBe(true);

            // Now click to collapse
            await page.click(folderSelector);
            await waitForTextContent(page, `${folderSelector} .bookmark-icon`, '▶');

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
        }
    }, 120000);
});
