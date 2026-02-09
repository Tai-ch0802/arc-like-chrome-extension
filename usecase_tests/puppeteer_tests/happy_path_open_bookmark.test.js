const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Open Bookmark Use Case', () => {
    let browser;
    let page;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        sidePanelUrl = setup.sidePanelUrl;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    /**
     * Helper: clean up extra tabs, keeping only the sidepanel page
     */
    async function cleanupExtraTabs() {
        try {
            await page.evaluate((spUrl) => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, tabs => {
                        // Keep the sidepanel tab, remove everything else
                        const idsToClose = tabs
                            .filter(t => !t.url.startsWith('chrome-extension://'))
                            .map(t => t.id);
                        if (idsToClose.length > 0) {
                            chrome.tabs.remove(idsToClose, resolve);
                        } else {
                            resolve();
                        }
                    });
                });
            }, sidePanelUrl);
        } catch (e) { }
    }

    afterEach(async () => {
        // After each test, clean up extra tabs and re-navigate to restore context
        await cleanupExtraTabs();
        // Re-navigate unconditionally to restore context
        await page.goto(sidePanelUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForSelector('#bookmark-list', { timeout: 10000 });
    });

    test('should open bookmark URL in new tab when clicking', async () => {
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
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`, { timeout: 10000 });

            const initialTabCount = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, tabs => resolve(tabs.length));
                });
            });

            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.click(bookmarkSelector);

            await page.waitForFunction(
                (expected) => {
                    return new Promise(resolve => {
                        chrome.tabs.query({}, tabs => resolve(tabs.length >= expected));
                    });
                },
                { timeout: 10000 },
                initialTabCount + 1
            );

            const finalTabCount = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, tabs => resolve(tabs.length));
                });
            });

            expect(finalTabCount).toBe(initialTabCount + 1);
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
        }
    }, 90000);

    test('should open correct URL when clicking bookmark', async () => {
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
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);
            await page.waitForSelector(`.bookmark-item[data-bookmark-id="${testBookmarkId}"]`, { timeout: 10000 });

            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;

            const initialCount = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, tabs => resolve(tabs.length));
                });
            });

            await page.click(bookmarkSelector);

            await page.waitForFunction(
                (expected) => {
                    return new Promise(resolve => {
                        chrome.tabs.query({}, tabs => resolve(tabs.length >= expected));
                    });
                },
                { timeout: 10000 },
                initialCount + 1
            );

            const allTabs = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.query({}, resolve);
                });
            });

            const newTab = allTabs.find(t =>
                (t.url && t.url.includes('example.com/open-test-2')) ||
                (t.pendingUrl && t.pendingUrl.includes('example.com/open-test-2'))
            );

            const targetTab = newTab || allTabs[allTabs.length - 1];

            expect(allTabs.length).toBeGreaterThanOrEqual(initialCount + 1);
            const tabUrl = targetTab.url || targetTab.pendingUrl || '';
            expect(tabUrl).toContain('example.com/open-test-2');
        } finally {
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
        }
    }, 90000);
});
