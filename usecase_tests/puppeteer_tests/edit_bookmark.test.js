const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Edit Bookmark Use Case', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should update bookmark title via Chrome API', async () => {
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Original Title',
                    url: 'https://example.com/edit-test'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        try {
            await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.bookmarks.update(id, { title: 'Updated Title' }, resolve);
                });
            }, testBookmarkId);

            const updated = await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.bookmarks.get(id, items => resolve(items[0]));
                });
            }, testBookmarkId);

            expect(updated.title).toBe('Updated Title');

            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`, { timeout: 10000 });

            const displayedTitle = await page.$eval(
                `.bookmark-item[data-bookmark-id="${testBookmarkId}"] .bookmark-title`,
                el => el.textContent
            );
            expect(displayedTitle).toBe('Updated Title');
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
        }
    }, 60000);

    test('should update bookmark URL via Chrome API', async () => {
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'URL Test Bookmark',
                    url: 'https://example.com/original-url'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        try {
            await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.bookmarks.update(id, { url: 'https://example.com/new-url' }, resolve);
                });
            }, testBookmarkId);

            const updated = await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.bookmarks.get(id, items => resolve(items[0]));
                });
            }, testBookmarkId);

            expect(updated.url).toBe('https://example.com/new-url');
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
        }
    }, 60000);

    test('should show edit button on bookmark hover', async () => {
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Hover Test Bookmark',
                    url: 'https://example.com/hover-test'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        try {
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);
            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.waitForSelector(bookmarkSelector, { timeout: 10000 });

            await page.hover(bookmarkSelector);

            await page.waitForSelector(`${bookmarkSelector} .bookmark-edit-btn`, { visible: true, timeout: 3000 });

            const editBtn = await page.$(`${bookmarkSelector} .bookmark-edit-btn`);
            expect(editBtn).not.toBeNull();
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
        }
    }, 60000);
});
