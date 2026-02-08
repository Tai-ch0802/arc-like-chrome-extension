const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

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
        await expandBookmarksBar(page);
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

    test('should add a new folder via the UI button', async () => {
        const parentFolderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;
        await page.waitForSelector(parentFolderSelector);

        // Find the add folder button
        const addBtnSelector = `${parentFolderSelector} .add-folder-btn`;

        // Click it (forcing click because it might be hidden until hover)
        // In Puppeteer, click triggers hover usually, but if it's display:none it fails.
        // Assuming the CSS handles hover or buttons are always present but maybe low opacity?
        // Let's try standard click. If it fails, we evaluate click.
        await page.evaluate((sel) => {
            document.querySelector(sel).click();
        }, addBtnSelector);

        // Wait for modal
        await page.waitForSelector('.modal-input');

        // Type new folder name
        const subFolderName = 'Sub Folder UI Test';
        await page.type('.modal-input', subFolderName);

        // Click confirm
        await page.click('.confirm-btn');

        // Wait for modal to disappear
        await page.waitForFunction(() => !document.querySelector('.modal-input'));

        // Wait for new folder to appear in UI
        await page.waitForFunction((name) => {
            const folders = Array.from(document.querySelectorAll('.bookmark-folder .bookmark-title'));
            return folders.some(el => el.textContent === name);
        }, {}, subFolderName);

        // Verify via API
        const subFolderExists = await page.evaluate(async (name) => {
             const items = await new Promise(r => chrome.bookmarks.search({title: name}, r));
             return items.length > 0;
        }, subFolderName);
        expect(subFolderExists).toBe(true);
    }, 45000);

    test('should rename a folder via the UI button', async () => {
        const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;
        await page.waitForSelector(folderSelector);

        // Find the edit button
        const editBtnSelector = `${folderSelector} .bookmark-edit-btn`;

        // Click it via evaluate
        await page.evaluate((sel) => {
            document.querySelector(sel).click();
        }, editBtnSelector);

        // Wait for modal
        await page.waitForSelector('.modal-input');

        // Clear input and type new name
        await page.click('.modal-input', { clickCount: 3 });
        const renamedName = 'Renamed via UI';
        await page.type('.modal-input', renamedName);

        // Click confirm
        await page.click('.confirm-btn');

        // Wait for modal to disappear
        await page.waitForFunction(() => !document.querySelector('.modal-input'));

        // Verify UI update
        await page.waitForFunction(
            (selector, name) => {
                const element = document.querySelector(selector);
                return element && element.querySelector('.bookmark-title').textContent === name;
            },
            {},
            folderSelector,
            renamedName
        );

        // Verify via API
        const updatedFolder = await page.evaluate((id) => {
            return new Promise(resolve => {
                chrome.bookmarks.get(id, (results) => {
                    resolve(results[0]);
                });
            });
        }, testFolderId);
        expect(updatedFolder.title).toBe(renamedName);
    }, 45000);
});
