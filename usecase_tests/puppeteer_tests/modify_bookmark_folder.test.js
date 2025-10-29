const { setupBrowser, teardownBrowser } = require('./setup');

describe('Modify Bookmark Folder Use Case', () => {
    let browser;
    let page;
    let testFolderId;
    const initialFolderName = 'Initial Test Folder';
    const newFolderName = 'Renamed Test Folder';

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        const folder = await page.evaluate((title) => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: title,
                }, resolve);
            });
        }, initialFolderName);
        testFolderId = folder.id;
        await page.reload();
        await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId}"]`);
    });

    afterEach(async () => {
        await page.evaluate((id) => {
            return new Promise(resolve => {
                if (!id) return resolve();
                chrome.bookmarks.get(id, (results) => {
                    if (results && results.length > 0) {
                        chrome.bookmarks.removeTree(id, resolve);
                    } else {
                        resolve();
                    }
                });
            });
        }, testFolderId);
        testFolderId = null;
    });

    test('should rename a bookmark folder using the chrome API and verify the change', async () => {
        const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;
        await page.waitForSelector(folderSelector);

        // Directly update the bookmark using the Chrome API via page.evaluate
        await page.evaluate(({ id, title }) => {
            return new Promise(resolve => {
                chrome.bookmarks.update(id, { title }, resolve);
            });
        }, { id: testFolderId, title: newFolderName });

        // Verify the folder name is updated in the side panel UI
        await page.waitForFunction(
            (selector, name) => {
                const element = document.querySelector(selector);
                return element && element.querySelector('.bookmark-title').textContent === name;
            },
            {},
            folderSelector,
            newFolderName
        );

        // Verify the folder name is updated in the browser's bookmarks API
        const updatedFolder = await page.evaluate((id) => {
            return new Promise(resolve => {
                chrome.bookmarks.get(id, (results) => {
                    resolve(results[0]);
                });
            });
        }, testFolderId);

        expect(updatedFolder.title).toBe(newFolderName);
    }, 45000);
});
