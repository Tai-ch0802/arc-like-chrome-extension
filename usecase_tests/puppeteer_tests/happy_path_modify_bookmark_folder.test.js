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
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    beforeEach(async () => {
        // Create folder via Chrome API
        const folder = await page.evaluate((title) => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: title,
                }, resolve);
            });
        }, initialFolderName);
        testFolderId = folder.id;

        // Reload only once to pick up the new folder and expand Bookmarks Bar
        await page.reload();
        await page.waitForSelector('#bookmark-list', { timeout: 10000 });
        await expandBookmarksBar(page);
        await page.waitForSelector(`.bookmark-folder[data-bookmark-id="${testFolderId}"]`, { timeout: 10000 });
    });

    afterEach(async () => {
        if (!testFolderId) return;
        await page.evaluate((id) => {
            return new Promise(resolve => {
                chrome.bookmarks.get(id, (results) => {
                    if (chrome.runtime.lastError || !results || results.length === 0) {
                        return resolve();
                    }
                    chrome.bookmarks.removeTree(id, resolve);
                });
            });
        }, testFolderId).catch(() => { });
        testFolderId = null;
    });

    test('should rename a bookmark folder using the chrome API and verify the change', async () => {
        const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;
        await page.waitForSelector(folderSelector, { timeout: 10000 });

        // Update the bookmark title via Chrome API
        await page.evaluate(({ id, title }) => {
            return new Promise(resolve => {
                chrome.bookmarks.update(id, { title }, resolve);
            });
        }, { id: testFolderId, title: newFolderName });

        // Verify the folder name is updated in the side panel UI
        await page.waitForFunction(
            (selector, name) => {
                const element = document.querySelector(selector);
                return element && element.querySelector('.bookmark-title')?.textContent === name;
            },
            { timeout: 10000 },
            folderSelector,
            newFolderName
        );

        // Verify via Chrome API
        const updatedFolder = await page.evaluate((id) => {
            return new Promise(resolve => {
                chrome.bookmarks.get(id, (results) => resolve(results[0]));
            });
        }, testFolderId);

        expect(updatedFolder.title).toBe(newFolderName);
    }, 45000);

    test('should add a new folder via the UI button', async () => {
        const parentFolderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;
        await page.waitForSelector(parentFolderSelector, { timeout: 10000 });

        // Click add-folder button via evaluate (headless hover is unreliable for hidden buttons)
        const addBtnSelector = `${parentFolderSelector} .add-folder-btn`;
        await page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (!btn) throw new Error(`Add folder button not found: ${sel}`);
            btn.click();
        }, addBtnSelector);

        // Wait for modal
        await page.waitForSelector('.modal-input', { timeout: 15000 });

        // Type new folder name
        const subFolderName = 'Sub Folder UI Test';
        await page.type('.modal-input', subFolderName);

        // Click confirm
        await page.click('.confirm-btn');

        // Wait for modal to disappear
        await page.waitForFunction(
            () => !document.querySelector('.modal-input'),
            { timeout: 15000 }
        );

        // Wait for new folder to appear in UI
        await page.waitForFunction((name) => {
            const folders = Array.from(document.querySelectorAll('.bookmark-folder .bookmark-title'));
            return folders.some(el => el.textContent === name);
        }, { timeout: 10000 }, subFolderName);

        // Verify via API
        const subFolderExists = await page.evaluate(async (name) => {
            const items = await new Promise(r => chrome.bookmarks.search({ title: name }, r));
            return items.length > 0;
        }, subFolderName);
        expect(subFolderExists).toBe(true);
    }, 45000);

    test('should rename a folder via the UI button', async () => {
        const folderSelector = `.bookmark-folder[data-bookmark-id="${testFolderId}"]`;
        await page.waitForSelector(folderSelector, { timeout: 10000 });

        // Click edit button via evaluate (headless hover is unreliable for hidden buttons)
        const editBtnSelector = `${folderSelector} .bookmark-edit-btn`;
        await page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (!btn) throw new Error(`Edit button not found: ${sel}`);
            btn.click();
        }, editBtnSelector);

        // Wait for modal
        await page.waitForSelector('.modal-input', { timeout: 15000 });

        // Clear input and type new name
        await page.click('.modal-input', { clickCount: 3 });
        const renamedName = 'Renamed via UI';
        await page.type('.modal-input', renamedName);

        // Click confirm
        await page.click('.confirm-btn');

        // Wait for modal to disappear
        await page.waitForFunction(
            () => !document.querySelector('.modal-input'),
            { timeout: 15000 }
        );

        // Verify UI update
        await page.waitForFunction(
            (selector, name) => {
                const element = document.querySelector(selector);
                return element && element.querySelector('.bookmark-title')?.textContent === name;
            },
            { timeout: 10000 },
            folderSelector,
            renamedName
        );

        // Verify via API
        const updatedFolder = await page.evaluate((id) => {
            return new Promise(resolve => {
                chrome.bookmarks.get(id, (results) => resolve(results[0]));
            });
        }, testFolderId);
        expect(updatedFolder.title).toBe(renamedName);
    }, 45000);
});
