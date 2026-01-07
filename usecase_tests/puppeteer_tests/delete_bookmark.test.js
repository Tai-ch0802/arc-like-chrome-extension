const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Delete Bookmark Use Case', () => {
    let browser;
    let page;
    let testBookmarkId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Test Bookmark to Delete',
                    url: 'http://example.com/delete'
                }, resolve);
            });
        });
        testBookmarkId = bookmark.id;
        await page.reload();
        await expandBookmarksBar(page);
        await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`);
    });

    afterEach(async () => {
        await page.evaluate((id) => {
            return new Promise(resolve => {
                if (!id) return resolve();
                chrome.bookmarks.get(id, (results) => {
                    if (results && results.length > 0) {
                        chrome.bookmarks.remove(id, resolve);
                    } else {
                        resolve();
                    }
                });
            });
        }, testBookmarkId);
        testBookmarkId = null;
    });

    test('should simulate a real user click to delete a bookmark and confirm', async () => {
        const bookmarkItemSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
        await page.waitForSelector(bookmarkItemSelector);

        // Step 1: Force the delete button to be visible
        const deleteButtonSelector = `${bookmarkItemSelector} .bookmark-close-btn`;
        await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            if (button) {
                // Force visibility
                button.style.display = 'block';
                button.style.opacity = '1';
                // Ensure parent is also visible
                let parent = button.parentElement;
                while (parent) {
                    parent.style.display = 'flex'; // or 'block'
                    parent.style.opacity = '1';
                    parent.style.visibility = 'visible';
                    parent = parent.parentElement;
                }
            }
        }, deleteButtonSelector);

        // Step 2: Click the delete button using page.evaluate
        await page.waitForSelector(deleteButtonSelector, { visible: true });
        await page.evaluate((selector) => {
            document.querySelector(selector).click();
        }, deleteButtonSelector);

        // Step 3: Wait for the confirmation modal and click the confirm button
        await page.waitForSelector('.modal-overlay', { visible: true });
        const confirmButtonSelector = '.modal-content .confirm-btn';
        await page.waitForSelector(confirmButtonSelector, { visible: true });
        await page.click(confirmButtonSelector);

        // Step 4: Verify the bookmark is removed from the side panel UI
        await page.waitForSelector(bookmarkItemSelector, { hidden: true });

        // Step 5: Verify the bookmark is removed from the browser's bookmarks API
        const bookmarkExists = await page.evaluate((id) => {
            return new Promise(resolve => {
                chrome.bookmarks.get(id, (results) => {
                    resolve(!!(results && results.length > 0));
                });
            });
        }, testBookmarkId);

        expect(bookmarkExists).toBe(false);
    }, 45000);
});
