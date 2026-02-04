const { setupBrowser, teardownBrowser, waitForElementRemoved } = require('./setup');

describe('Group Edge Cases', () => {
    let browser;
    let extensionId;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        extensionId = setup.extensionId;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close(); // Close initial page
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should update UI when group color changes', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        try {
            await page.waitForSelector('.tab-item');

            // Create a tab and group it
            const { groupId, tabId } = await page.evaluate(async () => {
                const tab = await new Promise(resolve => chrome.tabs.create({ url: 'https://example.com/group-color', active: false }, resolve));
                const groupId = await new Promise(resolve => chrome.tabs.group({ tabIds: tab.id }, resolve));
                await new Promise(resolve => chrome.tabGroups.update(groupId, { title: 'Color Test', color: 'blue' }, resolve));
                return { groupId, tabId: tab.id };
            });

            // Wait for group render
            const dotSelector = `.tab-group-header[data-group-id="${groupId}"] .tab-group-color-dot`;
            await page.waitForSelector(dotSelector);

            // Get initial color before changing
            const initialColor = await page.$eval(dotSelector, el => el.style.backgroundColor);

            // Update color to 'red'
            await page.evaluate(async (gid) => {
                await new Promise(resolve => chrome.tabGroups.update(gid, { color: 'red' }, resolve));
            }, groupId);

            // Wait for color to change using state-based waiting
            await page.waitForFunction(
                (selector, oldColor) => {
                    const el = document.querySelector(selector);
                    return el && el.style.backgroundColor !== oldColor;
                },
                { timeout: 5000 },
                dotSelector,
                initialColor
            );

            // Verify the color dot style has actually changed
            const newColor = await page.$eval(dotSelector, el => el.style.backgroundColor);
            expect(newColor).not.toBe(initialColor);
            expect(newColor).toBeTruthy();

        } finally {
            try { await page.close(); } catch (e) { /* intentionally ignored - cleanup only */ }
        }
    }, 60000);

    test('should remove group header when group becomes empty', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        try {
            await page.waitForSelector('.tab-item');

            // Create a tab and group it
            const { groupId, tabId } = await page.evaluate(async () => {
                const tab = await new Promise(resolve => chrome.tabs.create({ url: 'https://example.com/group-empty', active: false }, resolve));
                const groupId = await new Promise(resolve => chrome.tabs.group({ tabIds: tab.id }, resolve));
                await new Promise(resolve => chrome.tabGroups.update(groupId, { title: 'Empty Test' }, resolve));
                return { groupId, tabId: tab.id };
            });

            // Wait for group render
            const groupSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupSelector);

            // Ungroup the tab
            await page.evaluate(async (tid) => {
                await new Promise(resolve => chrome.tabs.ungroup(tid, resolve));
            }, tabId);

            // Wait for group header to be removed using state-based waiting
            await waitForElementRemoved(page, groupSelector);

            // Verify group header is gone
            const groupExists = await page.$(groupSelector);
            expect(groupExists).toBeNull();

        } finally {
            try { await page.close(); } catch (e) { /* intentionally ignored - cleanup only */ }
        }
    }, 60000);

});
