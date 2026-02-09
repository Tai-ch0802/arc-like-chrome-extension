const { setupBrowser, teardownBrowser } = require('./setup');
jest.setTimeout(60000); // Increased global timeout

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

        // Wait for extension to detect the new window by checking DOM
        await page.waitForFunction(
            (windowId) => document.querySelector(`.window-folder[data-window-id="${windowId}"]`),
            { timeout: 15000 }, // Increased timeout
            secondWindowId
        ).catch(async () => {
            // Fallback: reload and try again
            await page.reload();
            await page.waitForSelector('#other-windows-list');
        });

        // 2. Find the window folder for the new window
        const folderSelector = `.window-folder[data-window-id="${secondWindowId}"]`;
        await page.waitForSelector(folderSelector, { timeout: 10000 });

        // Scroll to element to ensure it's rendered
        await page.$eval(folderSelector, el => el.scrollIntoView());

        // 3. Find and click the edit button
        // Use evaluate(el.click()) because headless hover may not reveal the button
        await page.hover(folderSelector);
        const editBtnSelector = `${folderSelector} .window-edit-btn`;
        await page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (!btn) throw new Error(`Edit button not found: ${sel}`);
            btn.click();
        }, editBtnSelector);

        // 4. Handle Custom Modal
        const modalSelector = '.modal-content';
        await page.waitForSelector(modalSelector);

        const inputSelector = `${modalSelector} input.modal-input`;
        // Clear existing text by setting value directly (triple-click unreliable in headless)
        await page.$eval(inputSelector, el => { el.value = ''; });
        await page.type(inputSelector, 'My Custom Window Name');

        const confirmBtnSelector = `${modalSelector} button.confirm-btn`;
        await page.click(confirmBtnSelector);

        // Wait for modal to close first
        await page.waitForFunction(
            () => !document.querySelector('.modal-content'),
            { timeout: 10000 }
        );

        // Verify the title has updated (increased timeout for VM)
        await page.waitForFunction(
            (sel, expected) => {
                const el = document.querySelector(sel + ' .window-title');
                return el && el.textContent === expected;
            },
            { timeout: 30000 },
            folderSelector,
            'My Custom Window Name'
        );

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

        // 2. Wait for it to appear in DOM
        await page.waitForFunction(
            (windowId) => document.querySelector(`.window-folder[data-window-id="${windowId}"]`),
            { timeout: 15000 },
            tempWindowId
        ).catch(async () => {
            await page.reload();
        });
        const folderSelector = `.window-folder[data-window-id="${tempWindowId}"]`;
        await page.waitForSelector(folderSelector);

        // Scroll to element
        await page.$eval(folderSelector, el => el.scrollIntoView());

        // 3. Rename it
        await page.hover(folderSelector);
        // Force click via evaluate to avoid visibility issues
        const editBtnSelector = `${folderSelector} .window-edit-btn`;
        await page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (btn) btn.click();
        }, editBtnSelector);

        await page.waitForSelector('.modal-content input.modal-input');
        await page.type('.modal-content input.modal-input', 'Temporary Window');
        await page.click('.modal-content button.confirm-btn');

        // Wait for dialog to close and title to update
        await page.waitForFunction(
            () => !document.querySelector('.modal-content'),
            { timeout: 10000 }
        );

        // 4. Verify storage has it
        await page.waitForFunction((id) => {
            return new Promise(r => chrome.storage.local.get('windowNames', res => {
                r(res.windowNames && res.windowNames[id] === 'Temporary Window');
            }));
        }, { timeout: 10000 }, tempWindowId);

        // 5. Close the window
        await page.evaluate((id) => chrome.windows.remove(id), tempWindowId);

        // 6. Wait for cleanup by checking storage
        await page.waitForFunction(
            (id) => {
                return new Promise(resolve => {
                    chrome.storage.local.get('windowNames', (result) => {
                        resolve(!result.windowNames || result.windowNames[id] === undefined);
                    });
                });
            },
            { timeout: 15000 },
            tempWindowId
        );

        // 7. Verify storage removed it
        const storedNames = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.storage.local.get('windowNames', (result) => resolve(result.windowNames));
            });
        });
        expect(storedNames?.[tempWindowId]).toBeUndefined();
    });
});
