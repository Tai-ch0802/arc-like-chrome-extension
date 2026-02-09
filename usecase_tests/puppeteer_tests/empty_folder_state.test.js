const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Empty Folder State', () => {
    let browser;
    let page;
    let extensionId;

    beforeAll(async () => {
        ({ browser, page, extensionId } = await setupBrowser());
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    it('should display "Folder is empty" message when an empty folder is expanded', async () => {
        // 1. Create a new empty folder
        const folderTitle = 'Empty Test Folder';

        // Use evaluate to access chrome API in the extension context
        await page.evaluate(async (title) => {
            return new Promise((resolve) => {
                chrome.bookmarks.create({
                    parentId: '1', // Bookmarks Bar
                    title: title
                }, resolve);
            });
        }, folderTitle);

        // 2. Reload page to ensure UI is synced with Chrome API
        await page.reload();
        await page.waitForSelector('#bookmark-list');

        // 3. Ensure Bookmarks Bar is expanded
        await expandBookmarksBar(page);

        // 4. Find the newly created folder by title
        const folderSelector = `.bookmark-folder[title="${folderTitle}"]`;
        await page.waitForSelector(folderSelector);

        // 5. Expand the new folder
        const folderElement = await page.$(folderSelector);

        // Check if it is collapsed (it should be initially)
        const isCollapsed = await page.evaluate(el => el.querySelector('.bookmark-icon').textContent.includes('▶'), folderElement);
        if (isCollapsed) {
            await folderElement.click();
        }

        // 6. Check for the empty message
        // The structure in DOM is: folderItem then folderContent (siblings)
        const folderContentSelector = `.bookmark-folder[title="${folderTitle}"] + .folder-content`;
        await page.waitForSelector(folderContentSelector);

        // Wait for the message to appear inside .folder-content
        const messageSelector = `${folderContentSelector} .empty-folder-message`;
        await page.waitForSelector(messageSelector, { timeout: 2000 });

        const expectedMessage = await page.evaluate(() => {
            return chrome.i18n.getMessage("emptyFolder") || 'Folder is empty';
        });
        // Select the span to get the exact text, ignoring the icon
        const messageText = await page.$eval(`${messageSelector} span`, el => el.textContent);
        expect(messageText).toBe(expectedMessage);

        // Cleanup
        await page.evaluate(async (title) => {
            return new Promise((resolve) => {
                chrome.bookmarks.search({ title: title }, (results) => {
                    if (results.length > 0) {
                        chrome.bookmarks.removeTree(results[0].id, resolve);
                    } else {
                        resolve();
                    }
                });
            });
        }, folderTitle);
    }, 20000);
});
