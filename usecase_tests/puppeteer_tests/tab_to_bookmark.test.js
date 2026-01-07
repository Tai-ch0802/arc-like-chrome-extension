const { setupBrowser, teardownBrowser } = require('./setup');

describe('Tab to Bookmark Use Case', () => {
    let browser;
    let page;
    let createdTabIds = [];
    let createdBookmarkIds = [];
    const targetFolderName = 'Test Top-Level Folder for Tab to Bookmark';
    let targetFolderId = null;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        const tabs = await page.evaluate(() => new Promise(resolve => chrome.tabs.query({}, resolve)));
        if (tabs.length === 0) {
            const newTab = await page.evaluate(() => new Promise(resolve => chrome.tabs.create({ url: 'about:blank', active: false }, resolve)));
            createdTabIds.push(newTab.id);
        }

        const topLevelFolders = await page.evaluate((name) => {
            return new Promise(resolve => {
                chrome.bookmarks.getChildren('1', children => {
                    const folder = children.find(node => node.children && node.title === name);
                    resolve(folder);
                });
            });
        }, targetFolderName);

        if (!topLevelFolders) {
            console.log(`Folder "${targetFolderName}" not found. Creating one...`);
            const newFolder = await page.evaluate((name) => {
                return new Promise(resolve => chrome.bookmarks.create({ parentId: '1', title: name }, resolve));
            }, targetFolderName);
            createdBookmarkIds.push(newFolder.id);
            targetFolderId = newFolder.id;
        } else {
            targetFolderId = topLevelFolders.id;
        }

        await page.reload();
        await page.waitForSelector('.tab-item, .bookmark-item, .bookmark-folder');
    });

    afterEach(async () => {
        if (createdTabIds.length > 0) {
            await page.evaluate((ids) => new Promise(resolve => chrome.tabs.remove(ids, resolve)), createdTabIds);
            createdTabIds = [];
        }
        for (const id of createdBookmarkIds) {
            await page.evaluate((bookmarkId) => new Promise(resolve => chrome.bookmarks.removeTree(bookmarkId, resolve)), id);
        }
        createdBookmarkIds = [];
    });

    test('should trigger SortableJS drop event to create a bookmark', async () => {
        const tabSelector = '.tab-item';
        await page.waitForSelector(tabSelector);

        const tabTitle = await page.$eval(tabSelector, el => el.querySelector('.tab-title').textContent);
        const tabUrl = await page.$eval(tabSelector, el => el.dataset.url);

        const bookmarksBarSelector = `.bookmark-folder[data-bookmark-id="1"]`;
        await page.waitForSelector(bookmarksBarSelector);
        const isBookmarksBarCollapsed = await page.$eval(bookmarksBarSelector, el => el.querySelector('.bookmark-icon').textContent.includes('▶'));
        if (isBookmarksBarCollapsed) {
            await page.click(bookmarksBarSelector);
            await page.waitForFunction(s => document.querySelector(s).querySelector('.bookmark-icon').textContent.includes('▼'), {}, bookmarksBarSelector);
        }

        const targetFolderSelector = `.bookmark-folder[data-bookmark-id="${targetFolderId}"]`;
        await page.waitForSelector(targetFolderSelector);
        const isTargetFolderCollapsed = await page.$eval(targetFolderSelector, el => el.querySelector('.bookmark-icon').textContent.includes('▶'));
        if (isTargetFolderCollapsed) {
            await page.click(targetFolderSelector);
            await page.waitForFunction(s => document.querySelector(s).querySelector('.bookmark-icon').textContent.includes('▼'), {}, targetFolderSelector);
        }

        const dropTargetSelector = `.bookmark-folder[data-bookmark-id="${targetFolderId}"] + .folder-content`;
        await page.waitForSelector(dropTargetSelector);

        // Wait for Sortable to be initialized on the drop target
        await page.waitForFunction(
            (selector) => {
                const el = document.querySelector(selector);
                return el && typeof Sortable !== 'undefined' && Sortable.get(el);
            },
            { timeout: 5000 },
            dropTargetSelector
        );

        // Directly trigger the SortableJS onAdd event
        const dropResult = await page.evaluate((dropSelector) => {
            const dropElement = document.querySelector(dropSelector);
            const tabElement = document.querySelector('.tab-item');

            // Find the Sortable instance for the drop target
            const sortableInstance = Sortable.get(dropElement);
            if (sortableInstance && tabElement) {
                const evt = {
                    item: tabElement,
                    to: dropElement,
                    from: document.getElementById('tab-list'),
                    newIndex: 0
                };
                sortableInstance.options.onAdd(evt);
                return { success: true };
            }
            return { success: false, hasSortable: !!sortableInstance, hasTab: !!tabElement };
        }, dropTargetSelector);

        if (!dropResult.success) {
            throw new Error(`Drop event failed: ${JSON.stringify(dropResult)}`);
        }

        await page.waitForFunction(
            (folderId, title) => {
                return new Promise(resolve => {
                    chrome.bookmarks.getChildren(folderId, children => {
                        resolve(children.some(b => b.title === title));
                    });
                });
            },
            { timeout: 10000 },
            targetFolderId,
            tabTitle
        );

        const newBookmark = await page.evaluate((folderId, title) => {
            return new Promise(resolve => {
                chrome.bookmarks.getChildren(folderId, children => {
                    resolve(children.find(b => b.title === title));
                });
            });
        }, targetFolderId, tabTitle);

        expect(newBookmark).toBeDefined();
        expect(newBookmark.url).toBe(tabUrl);
        if (newBookmark) createdBookmarkIds.push(newBookmark.id);

    }, 60000);
});
