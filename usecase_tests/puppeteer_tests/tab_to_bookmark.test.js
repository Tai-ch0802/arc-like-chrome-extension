const { setupBrowser, teardownBrowser } = require('./setup');

describe('Tab to Bookmark Use Case', () => {
    let browser;
    let page;
    let createdTabIds = [];
    let createdBookmarkIds = [];
    const targetFolderName = 'Test Top-Level Folder for Tab to Bookmark';
    let targetFolderId = null; // Will be set in beforeEach

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        // Ensure at least 1 tab is open
        const tabs = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.tabs.query({}, resolve);
            });
        });
        if (tabs.length === 0) {
            const newTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'about:blank', active: false }, resolve);
                });
            });
            createdTabIds.push(newTab.id);
        }

        // Ensure a specific TOP-LEVEL bookmark folder exists
        const topLevelFolders = await page.evaluate((name) => {
            return new Promise(resolve => {
                chrome.bookmarks.getChildren('1', children => { // '1' is the Bookmarks Bar or Other Bookmarks
                    const folder = children.find(node => node.children && node.title === name);
                    resolve(folder);
                });
            });
        }, targetFolderName);

        if (!topLevelFolders) {
            console.log(`Folder "${targetFolderName}" not found. Creating one via Chrome API for test setup.`);
            const newFolder = await page.evaluate((name) => {
                return new Promise(resolve => {
                    chrome.bookmarks.create({ parentId: '1', title: name }, resolve);
                });
            }, targetFolderName);
            createdBookmarkIds.push(newFolder.id);
            targetFolderId = newFolder.id;
        } else {
            targetFolderId = topLevelFolders.id;
        }

        // Wait for the side panel to update
        await new Promise(r => setTimeout(r, 1000));
        // Ensure the side panel content is rendered before starting the test
        await page.waitForSelector('.tab-item, .bookmark-item, .bookmark-folder');
    });

    afterEach(async () => {
        // Close any tabs created by this test
        if (createdTabIds.length > 0) {
            await page.evaluate((ids) => {
                return new Promise(resolve => {
                    chrome.tabs.remove(ids, resolve);
                });
            }, createdTabIds);
            createdTabIds = [];
        }
        // Remove any bookmarks/folders created by this test
        if (createdBookmarkIds.length > 0) {
            for (const id of createdBookmarkIds) {
                await page.evaluate((bookmarkId) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.removeTree(bookmarkId, resolve);
                    });
                }, id);
            }
            createdBookmarkIds = [];
        }
        // Reload the side panel to ensure a clean state for the next test
        await page.reload();
        await page.waitForSelector('.tab-item, .bookmark-item, .bookmark-folder'); // Wait for content to render
    });

    test('should allow dragging a tab to a bookmark folder to create a new bookmark', async () => {
        // Get a tab to drag
        const tabToDragHandle = await page.$('.tab-item');
        expect(tabToDragHandle).not.toBeNull();
        const tabTitle = await tabToDragHandle.evaluate(el => el.querySelector('.tab-title').textContent);
        const tabUrl = await tabToDragHandle.evaluate(el => el.dataset.url);
        
        console.log(`Attempting to bookmark tab with Title: "${tabTitle}", URL: "${tabUrl}"`); // DEBUG LOG

        // --- Step 2: Click to expand the "書籤列" (Bookmarks Bar) folder --- 
        const bookmarksBarId = '1'; // ID for "書籤列"
        const bookmarksBarSelector = `.bookmark-folder[data-bookmark-id="${bookmarksBarId}"]`;
        await page.waitForSelector(bookmarksBarSelector, { timeout: 10000 });
        let bookmarksBarHandle = await page.$(bookmarksBarSelector);
        expect(bookmarksBarHandle).not.toBeNull();

        const isBookmarksBarCollapsed = await bookmarksBarHandle.evaluate(el => el.querySelector('.bookmark-icon').textContent.includes('▶'));
        if (isBookmarksBarCollapsed) {
            console.log('Bookmarks Bar is collapsed. Expanding...'); // DEBUG LOG
            await bookmarksBarHandle.click(); // Click to expand
            await page.waitForFunction(
                (selector) => {
                    const el = document.querySelector(selector);
                    return el && el.querySelector('.bookmark-icon').textContent.includes('▼');
                },
                { timeout: 5000 },
                bookmarksBarSelector
            );
            await new Promise(r => setTimeout(r, 500)); // Additional small delay after expansion
            bookmarksBarHandle = await page.$(bookmarksBarSelector); // Re-query handle after expansion
            expect(bookmarksBarHandle).not.toBeNull();
        }
        // --- End Step 2 part 1 --- 
        // Step 2 part 2: Expand the targetFolder
        const targetFolderSelector = `.bookmark-folder[data-bookmark-id="${targetFolderId}"]`;
        await page.waitForSelector(targetFolderSelector, { timeout: 10000 });
        let targetFolderHandle = await page.$(targetFolderSelector);
        expect(targetFolderHandle).not.toBeNull();

        const isTargetFolderCollapsed = await targetFolderHandle.evaluate(el => el.querySelector('.bookmark-icon').textContent.includes('▶'));
        if (isTargetFolderCollapsed) {
            console.log(`Target folder "${targetFolderName}" is collapsed. Expanding...`); // DEBUG LOG
            await targetFolderHandle.click(); // Click to expand
            await page.waitForFunction(
                (selector) => {
                    const el = document.querySelector(selector);
                    return el && el.querySelector('.bookmark-icon').textContent.includes('▼');
                },
                { timeout: 5000 },
                targetFolderSelector
            );
            await new Promise(r => setTimeout(r, 500)); // Additional small delay after expansion
            targetFolderHandle = await page.$(targetFolderSelector); // Re-query handle after expansion
            expect(targetFolderHandle).not.toBeNull();
        }
        // --- End Step 2 part 2 ---

        // Step 3: Drag tab to the target bookmark folder and check for ghost image
        const tabBoundingBox = await tabToDragHandle.boundingBox();
        const targetFolderBoundingBox = await targetFolderHandle.boundingBox();

        // Start drag from the center of the tab
        await page.mouse.move(tabBoundingBox.x + tabBoundingBox.width / 2, tabBoundingBox.y + tabBoundingBox.height / 2);
        await page.mouse.down();

        // Move to the center of the target folder
        await page.mouse.move(targetFolderBoundingBox.x + targetFolderBoundingBox.width / 2, targetFolderBoundingBox.y + targetFolderBoundingBox.height / 2, { steps: 10 });

        // Release the mouse button
        await page.mouse.up();

        // --- DEBUG PAUSE --- 
        //FIXME 待處理前端的行為測試 
        console.log('Mouse released. Pausing for 20 seconds for manual inspection...');
        await new Promise(r => setTimeout(r, 20000)); // Pause for 20 seconds
        console.log('Resuming test...');
        // --- END DEBUG PAUSE --- 

        //TODO 等待畫面渲染，確認是否新增分頁 A 至書籤目標資料夾當中。

    }, 60000); // Increased timeout for more robust E2E test
});