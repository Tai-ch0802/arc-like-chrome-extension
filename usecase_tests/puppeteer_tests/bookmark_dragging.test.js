const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Bookmark Dragging Use Case', () => {
    let browser;
    let page;
    let testFolderId1, testFolderId2, testBookmarkId1, testBookmarkId2;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        const folder1 = await page.evaluate(() => new Promise(r => chrome.bookmarks.create({ parentId: '1', title: 'Test Folder 1' }, r)));
        const folder2 = await page.evaluate(() => new Promise(r => chrome.bookmarks.create({ parentId: '1', title: 'Test Folder 2' }, r)));

        const bookmark1 = await page.evaluate(id => new Promise(r => chrome.bookmarks.create({ parentId: id, title: 'Test Bookmark 1', url: 'http://example.com/1' }, r)), folder1.id);
        const bookmark2 = await page.evaluate(id => new Promise(r => chrome.bookmarks.create({ parentId: id, title: 'Test Bookmark 2', url: 'http://example.com/2' }, r)), folder1.id);

        testFolderId1 = folder1.id;
        testFolderId2 = folder2.id;
        testBookmarkId1 = bookmark1.id;
        testBookmarkId2 = bookmark2.id;

        await page.reload();
        await expandBookmarksBar(page);

        await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId1}"]`);
        await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId2}"]`);

        await page.click(`.bookmark-folder[data-bookmark-id="${testFolderId1}"]`);
        await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId1}"]`);
        await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId2}"]`);

        await new Promise(r => setTimeout(r, 1000));
    });

    afterEach(async () => {
        if (testFolderId1) await page.evaluate(id => new Promise(r => chrome.bookmarks.removeTree(id, r)), testFolderId1);
        if (testFolderId2) await page.evaluate(id => new Promise(r => chrome.bookmarks.removeTree(id, r)), testFolderId2);
        testFolderId1 = testFolderId2 = testBookmarkId1 = testBookmarkId2 = null;
    });

    test('should move a bookmark from one folder to another using the chrome API', async () => {
        await page.evaluate(({ id, parentId, index }) => {
            return new Promise(resolve => {
                chrome.bookmarks.move(id, { parentId, index }, resolve);
            });
        }, { id: testBookmarkId1, parentId: testFolderId2, index: 0 });

        const newParent = await page.evaluate(id => {
            return new Promise(r => chrome.bookmarks.get(id, items => r(items[0].parentId)));
        }, testBookmarkId1);

        expect(newParent).toBe(testFolderId2);
    }, 45000);

    test('should reorder bookmarks within the same folder via drag and drop', async () => {
        const bookmark1 = await page.$(`.bookmark-item[data-bookmark-id="${testBookmarkId1}"]`);
        const bookmark2 = await page.$(`.bookmark-item[data-bookmark-id="${testBookmarkId2}"]`);

        const box1 = await bookmark1.boundingBox();
        const box2 = await bookmark2.boundingBox();

        if (!box1 || !box2) throw new Error('Bounding box is null');

        // Drag 1 to below 2
        await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 200));

        await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height + 5, { steps: 50 });
        await new Promise(r => setTimeout(r, 500));
        await page.mouse.up();

        await page.waitForFunction((id1, id2) => {
            const items = Array.from(document.querySelectorAll('.bookmark-item'));
            const index1 = items.findIndex(el => el.dataset.bookmarkId === id1);
            const index2 = items.findIndex(el => el.dataset.bookmarkId === id2);
            return index1 > index2;
        }, { timeout: 10000 }, testBookmarkId1, testBookmarkId2);

        const indices = await page.evaluate(async (id1, id2) => {
            const b1 = await new Promise(r => chrome.bookmarks.get(id1, res => r(res[0])));
            const b2 = await new Promise(r => chrome.bookmarks.get(id2, res => r(res[0])));
            return { index1: b1.index, index2: b2.index };
        }, testBookmarkId1, testBookmarkId2);

        expect(indices.index1).toBeGreaterThan(indices.index2);
    }, 60000);
});
