const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Open Bookmark Use Case', () => {
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

    test('should open bookmark URL in new tab when clicking', async () => {
        // Create a fresh page for this test
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#bookmark-list');

        // Create a test bookmark
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Test Open Bookmark 1',
                    url: 'https://example.com/open-test-1'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        try {
            // Reload and expand Bookmarks Bar
            await page.reload();
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`);

            // Get initial tab count
            const initialTabCount = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, tabs => resolve(tabs.length));
                });
            });

            // Click on the bookmark
            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.click(bookmarkSelector);

            // Wait for new tab to be created
            await new Promise(r => setTimeout(r, 1000));

            // Verify a new tab was created
            const finalTabCount = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, tabs => resolve(tabs.length));
                });
            });

            expect(finalTabCount).toBe(initialTabCount + 1);
        } finally {
            // Cleanup - do in a fresh page context
            const cleanupPage = await browser.newPage();
            await cleanupPage.goto(sidePanelUrl);
            await cleanupPage.waitForSelector('#tab-list');

            try {
                // Remove bookmark
                await cleanupPage.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }

            // Close extra tabs
            try {
                const tabs = await cleanupPage.evaluate(() => {
                    return new Promise(resolve => {
                        chrome.tabs.query({}, resolve);
                    });
                });
                if (tabs.length > 1) {
                    const tabsToClose = tabs.slice(1).map(t => t.id);
                    await cleanupPage.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, tabsToClose);
                }
            } catch (e) { }

            try { await cleanupPage.close(); } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 90000);

    test('should open correct URL when clicking bookmark', async () => {
        // Create a fresh page for this test
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#bookmark-list');

        // Create a test bookmark
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Test Open Bookmark 2',
                    url: 'https://example.com/open-test-2'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        try {
            // Reload and expand Bookmarks Bar
            await page.reload();
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`);

            // Click on the bookmark
            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.click(bookmarkSelector);

            // Wait for tab to be created
            await new Promise(r => setTimeout(r, 1500));

            // Get the newly created tab's URL
            const activeTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                        resolve(tabs[0]);
                    });
                });
            });

            expect(activeTab.url).toBe('https://example.com/open-test-2');
        } finally {
            // Cleanup - do in a fresh page context
            const cleanupPage = await browser.newPage();
            await cleanupPage.goto(sidePanelUrl);
            await cleanupPage.waitForSelector('#tab-list');

            try {
                // Remove bookmark
                await cleanupPage.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }

            // Close extra tabs
            try {
                const tabs = await cleanupPage.evaluate(() => {
                    return new Promise(resolve => {
                        chrome.tabs.query({}, resolve);
                    });
                });
                if (tabs.length > 1) {
                    const tabsToClose = tabs.slice(1).map(t => t.id);
                    await cleanupPage.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, tabsToClose);
                }
            } catch (e) { }

            try { await cleanupPage.close(); } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 90000);
}, 240000);
