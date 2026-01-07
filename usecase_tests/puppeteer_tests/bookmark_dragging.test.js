const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Bookmark Dragging Use Case', () => {
    let browser;
    let page;
    let testFolderId1, testFolderId2, testBookmarkId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        // Create two folders and one bookmark for testing
        const folder1 = await page.evaluate(() => new Promise(r => chrome.bookmarks.create({ parentId: '1', title: 'Test Folder 1' }, r)));
        const folder2 = await page.evaluate(() => new Promise(r => chrome.bookmarks.create({ parentId: '1', title: 'Test Folder 2' }, r)));
        const bookmark = await page.evaluate(id => new Promise(r => chrome.bookmarks.create({ parentId: id, title: 'Test Bookmark', url: 'http://example.com/test' }, r)), folder1.id);

        testFolderId1 = folder1.id;
        testFolderId2 = folder2.id;
        testBookmarkId = bookmark.id;

        await page.reload();
        await expandBookmarksBar(page);
        await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId1}"]`);
        await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId2}"]`);
    });

    afterEach(async () => {
        // Cleanup created bookmarks and folders
        if (testFolderId1) await page.evaluate(id => new Promise(r => chrome.bookmarks.removeTree(id, r)), testFolderId1);
        if (testFolderId2) await page.evaluate(id => new Promise(r => chrome.bookmarks.removeTree(id, r)), testFolderId2);
        testFolderId1 = testFolderId2 = testBookmarkId = null;
    });

    test('should move a bookmark from one folder to another using the chrome API', async () => {
        // Directly move the bookmark using the Chrome API via page.evaluate
        await page.evaluate(({ id, parentId, index }) => {
            return new Promise(resolve => {
                chrome.bookmarks.move(id, { parentId, index }, resolve);
            });
        }, { id: testBookmarkId, parentId: testFolderId2, index: 0 });

        // Verify the bookmark's parent has changed in the browser's bookmarks API
        const newParent = await page.evaluate(id => {
            return new Promise(r => chrome.bookmarks.get(id, items => r(items[0].parentId)));
        }, testBookmarkId);

        expect(newParent).toBe(testFolderId2);
    }, 45000);
});
