const { setupBrowser, teardownBrowser } = require('./setup');
jest.setTimeout(30000);

describe('Window Renaming Feature', () => {
    let browser;
    let page;
    let extensionId;
    let sidePanelUrl;
    let secondWindowId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        sidePanelUrl = setup.sidePanelUrl;
    });

    afterAll(async () => {
        if (secondWindowId) {
            try {
                await page.evaluate((id) => chrome.windows.remove(id), secondWindowId);
            } catch (e) { }
        }
        await teardownBrowser(browser);
    });

    test('Should be able to rename a window in "Other Windows" section', async () => {
        // 1. Create a second window to ensure "Other Windows" section appears
        const newWindow = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.windows.create({ url: 'https://example.com', focused: false }, resolve);
            });
        });
        secondWindowId = newWindow.id;

        // Wait for extension to detect the new window
        await new Promise(r => setTimeout(r, 2000));
        await page.reload();
        await page.waitForSelector('#other-windows-list');

        // 2. Find the window folder for the new window
        // The new window should be in the list. Index might vary, but we can look for the one with data-window-id matching secondWindowId
        const folderSelector = `.window-folder[data-window-id="${secondWindowId}"]`;
        await page.waitForSelector(folderSelector);

        // 3. Find and click the edit button
        // Need to hover first because the button is hidden and has pointer-events: none
        await page.hover(folderSelector);
        const editBtnSelector = `${folderSelector} .window-edit-btn`;
        await page.waitForSelector(editBtnSelector);

        await page.click(editBtnSelector);

        // 4. Handle Custom Modal
        const modalSelector = '.modal-content';
        await page.waitForSelector(modalSelector);

        const inputSelector = `${modalSelector} input.modal-input`;
        await page.type(inputSelector, 'My Custom Window Name');

        const confirmBtnSelector = `${modalSelector} button.confirm-btn`;
        await page.click(confirmBtnSelector);

        // 5. Verify the title has updated
        await new Promise(r => setTimeout(r, 500));

        const newTitle = await page.$eval(`${folderSelector} .window-title`, el => el.textContent);
        expect(newTitle).toBe('My Custom Window Name');
    });
    test('Should remove window name from storage when window is closed', async () => {
        // 1. Create a new window
        const tempWindow = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.windows.create({ url: 'about:blank', focused: false }, resolve);
            });
        });
        const tempWindowId = tempWindow.id;

        // 2. Wait for it to appear
        await new Promise(r => setTimeout(r, 1000));
        await page.reload();
        const folderSelector = `.window-folder[data-window-id="${tempWindowId}"]`;
        await page.waitForSelector(folderSelector);

        // 3. Rename it
        await page.hover(folderSelector);
        await page.click(`${folderSelector} .window-edit-btn`);
        await page.waitForSelector('.modal-content input.modal-input');
        await page.type('.modal-content input.modal-input', 'Temporary Window');
        await page.click('.modal-content button.confirm-btn');
        await new Promise(r => setTimeout(r, 500));

        // 4. Verify storage has it
        let storedNames = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.storage.local.get('windowNames', (result) => resolve(result.windowNames));
            });
        });
        expect(storedNames[tempWindowId]).toBe('Temporary Window');

        // 5. Close the window
        await page.evaluate((id) => chrome.windows.remove(id), tempWindowId);

        // 6. Wait for cleanup
        await new Promise(r => setTimeout(r, 1000));

        // 7. Verify storage removed it
        storedNames = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.storage.local.get('windowNames', (result) => resolve(result.windowNames));
            });
        });
        expect(storedNames[tempWindowId]).toBeUndefined();
    });
});
