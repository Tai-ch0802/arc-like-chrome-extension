const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Bookmark Edge Cases', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        // Wait for initial app load
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 60000);

    afterAll(async () => {
        if (browser) await teardownBrowser(browser);
    });

    test('should handle deeply nested folders', async () => {
        let rootFolderId;

        try {
            // Create 5 levels of nesting
            const ids = await page.evaluate(async () => {
                let parentId = '1'; // Bookmarks Bar
                let rootId = null;

                for (let i = 1; i <= 5; i++) {
                    const folder = await new Promise(resolve =>
                        chrome.bookmarks.create({ parentId, title: `Nested Level ${i}` }, resolve)
                    );
                    if (i === 1) rootId = folder.id;
                    parentId = folder.id;
                }
                // Add a bookmark at the deepest level
                await new Promise(resolve =>
                    chrome.bookmarks.create({ parentId, title: 'Deep Bookmark', url: 'https://example.com/deep' }, resolve)
                );
                return rootId;
            });
            rootFolderId = ids;

            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);

            // Expand folders one by one
            for (let i = 1; i <= 5; i++) {
                const title = `Nested Level ${i}`;

                await page.evaluate((folderTitle) => {
                    const folders = Array.from(document.querySelectorAll('.bookmark-folder'));
                    const folder = folders.find(el => el.textContent.includes(folderTitle));
                    if (folder) folder.click();
                }, title);

                // Wait for the next level to appear
                const nextTitle = i < 5 ? `Nested Level ${i + 1}` : 'Deep Bookmark';
                await page.waitForFunction(
                    (t) => {
                        const allElements = Array.from(document.querySelectorAll('.bookmark-folder, .bookmark-item'));
                        const el = allElements.find(e => e.textContent.includes(t));
                        return el && el.offsetParent !== null;
                    },
                    { timeout: 5000 },
                    nextTitle
                );
            }

            // Final verify
            const isVisible = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('.bookmark-item'));
                const el = els.find(e => e.textContent.includes('Deep Bookmark'));
                return el && el.offsetParent !== null;
            });
            expect(isVisible).toBe(true);

        } finally {
            if (rootFolderId) {
                try {
                    await page.evaluate((id) => chrome.bookmarks.removeTree(id), rootFolderId);
                } catch (e) { }
            }
        }
    }, 60000);

    test('should handle duplicate bookmarks in same folder', async () => {
        let createdIds = [];

        try {
            createdIds = await page.evaluate(async () => {
                const b1 = await new Promise(r => chrome.bookmarks.create({ parentId: '1', title: 'Duplicate Bookmark', url: 'https://dup.com' }, r));
                const b2 = await new Promise(r => chrome.bookmarks.create({ parentId: '1', title: 'Duplicate Bookmark', url: 'https://dup.com' }, r));
                return [b1.id, b2.id];
            });

            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);

            // Check if 2 elements with text "Duplicate Bookmark" exist
            const count = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.bookmark-item'));
                return items.filter(i => i.textContent.includes('Duplicate Bookmark')).length;
            });
            expect(count).toBeGreaterThanOrEqual(2);

        } finally {
            if (createdIds.length > 0) {
                try {
                    await page.evaluate((ids) => ids.forEach(id => chrome.bookmarks.remove(id)), createdIds);
                } catch (e) { }
            }
        }
    }, 45000);

    test('should handle invalid URLs gracefully', async () => {
        let createdId;

        try {
            const invalidUrl = 'javascript:void(0)';

            createdId = await page.evaluate(async (url) => {
                try {
                    const b = await new Promise((resolve) => {
                        chrome.bookmarks.create({ parentId: '1', title: 'Invalid URL Bookmark', url: url }, (res) => {
                            if (chrome.runtime.lastError) resolve(null);
                            else resolve(res.id);
                        });
                    });
                    return b;
                } catch (e) {
                    return null;
                }
            }, invalidUrl);

            if (createdId) {
                await page.reload();
                await page.waitForSelector('#bookmark-list', { timeout: 10000 });
                await expandBookmarksBar(page);

                // Verify it is rendered
                const exists = await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('.bookmark-item'));
                    return items.some(i => i.textContent.includes('Invalid URL Bookmark'));
                });
                expect(exists).toBe(true);

                // Clicking it should not crash the extension
                await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('.bookmark-item'));
                    const item = items.find(i => i.textContent.includes('Invalid URL Bookmark'));
                    if (item) {
                        const link = item.querySelector('a') || item;
                        link.click();
                    }
                });

                // Assert page is still responsive
                const title = await page.title();
                expect(title).toBeDefined();

            } else {
                console.log('Browser rejected invalid URL creation, which is also a pass.');
            }

        } finally {
            if (createdId) {
                try { await page.evaluate((id) => chrome.bookmarks.remove(id), createdId); } catch (e) { }
            }
        }
    }, 45000);
});
