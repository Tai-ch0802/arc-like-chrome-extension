const { setupBrowser, teardownBrowser, waitForAttribute } = require('./setup');

describe('Tab Group Toggle Use Case', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should toggle tab group collapse/expand when clicking header', async () => {
        const createdTabIds = [];
        for (let i = 0; i < 2; i++) {
            const newTab = await page.evaluate((index) => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: `https://example.com/group-toggle-${index}`,
                        active: false
                    }, resolve);
                });
            }, i);
            createdTabIds.push(newTab.id);
        }

        let groupId;
        try {
            groupId = await page.evaluate((tabIds) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds }, resolve);
                });
            }, createdTabIds);

            await page.evaluate((gId) => {
                return new Promise(resolve => {
                    chrome.tabGroups.update(gId, { title: 'Toggle Test' }, resolve);
                });
            }, groupId);

            await page.reload();
            await page.waitForSelector('.tab-group-header', { timeout: 10000 });

            const groupHeaderSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupHeaderSelector, { timeout: 10000 });

            const initiallyCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            await page.click(groupHeaderSelector);

            const expectedAfterClick = initiallyCollapsed ? 'false' : 'true';
            await waitForAttribute(page, groupHeaderSelector, 'data-collapsed', expectedAfterClick);

            const afterClickCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            expect(afterClickCollapsed).toBe(!initiallyCollapsed);

            // Click again to toggle back
            await page.click(groupHeaderSelector);

            const expectedFinal = initiallyCollapsed ? 'true' : 'false';
            await waitForAttribute(page, groupHeaderSelector, 'data-collapsed', expectedFinal);

            const finalCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            expect(finalCollapsed).toBe(initiallyCollapsed);
        } finally {
            try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
        }
    }, 90000);

    test('should show/hide group content when toggling', async () => {
        const createdTabIds = [];
        for (let i = 0; i < 2; i++) {
            const newTab = await page.evaluate((index) => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: `https://example.com/content-toggle-${index}`,
                        active: false
                    }, resolve);
                });
            }, i);
            createdTabIds.push(newTab.id);
        }

        let groupId;
        try {
            groupId = await page.evaluate((tabIds) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds }, resolve);
                });
            }, createdTabIds);

            await page.evaluate((gId) => {
                return new Promise(resolve => {
                    chrome.tabGroups.update(gId, { title: 'Content Test' }, resolve);
                });
            }, groupId);

            await page.reload();
            await page.waitForSelector('.tab-group-header', { timeout: 10000 });

            const groupHeaderSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupHeaderSelector, { timeout: 10000 });

            const initiallyCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            await page.click(groupHeaderSelector);

            const expectedAfterToggle = initiallyCollapsed ? 'false' : 'true';
            await waitForAttribute(page, groupHeaderSelector, 'data-collapsed', expectedAfterToggle);

            const afterToggleVisible = await page.$eval(groupHeaderSelector, el => {
                const content = el.nextElementSibling;
                return content && window.getComputedStyle(content).display !== 'none';
            });

            expect(afterToggleVisible).toBe(initiallyCollapsed);
        } finally {
            try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
        }
    }, 90000);
});
