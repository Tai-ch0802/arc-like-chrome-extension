const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Edit Bookmark Use Case', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close();
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should update bookmark title via Chrome API', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#bookmark-list');

        // Create a test bookmark
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
            // Update the bookmark title via Chrome API
            await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.bookmarks.update(id, { title: 'Updated Title' }, resolve);
                });
            }, testBookmarkId);

            // Verify the update was applied
            const updated = await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.bookmarks.get(id, items => resolve(items[0]));
                });
            }, testBookmarkId);

            expect(updated.title).toBe('Updated Title');

            // Reload and verify UI reflects the change
            await page.reload();
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`);

            // Check the displayed title
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
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should update bookmark URL via Chrome API', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#bookmark-list');

        // Create a test bookmark
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
            // Update the bookmark URL
            await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.bookmarks.update(id, { url: 'https://example.com/new-url' }, resolve);
                });
            }, testBookmarkId);

            // Verify the update was applied
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
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should show edit button on bookmark hover', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#bookmark-list');

        // Create a test bookmark
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
            await expandBookmarksBar(page);
            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.waitForSelector(bookmarkSelector);

            // Hover over the bookmark
            await page.hover(bookmarkSelector);

            // Wait for edit button to be visible
            await page.waitForSelector(`${bookmarkSelector} .bookmark-edit-btn`, { visible: true, timeout: 3000 });

            // Check if edit button is visible (or exists)
            const editBtn = await page.$(`${bookmarkSelector} .bookmark-edit-btn`);
            // The edit button should exist in the DOM
            expect(editBtn).not.toBeNull();
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);
}, 240000);
