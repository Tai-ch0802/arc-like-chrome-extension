const { setupBrowser, teardownBrowser, waitForAttribute } = require('./setup');

describe('Tab Group Toggle Use Case', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close();
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should toggle tab group collapse/expand when clicking header', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        // Create tabs and a group
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
            // Create a tab group with these tabs
            groupId = await page.evaluate((tabIds) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds }, resolve);
                });
            }, createdTabIds);

            // Update group title
            await page.evaluate((gId) => {
                return new Promise(resolve => {
                    chrome.tabGroups.update(gId, { title: 'Toggle Test' }, resolve);
                });
            }, groupId);

            // Reload to see group
            await page.reload();
            await page.waitForSelector('.tab-group-header');

            // Find the group header
            const groupHeaderSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupHeaderSelector);

            // Get initial collapsed state from header's data-collapsed attribute
            const initiallyCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            // Click to toggle
            await page.click(groupHeaderSelector);

            // Wait for data-collapsed attribute to change
            const expectedAfterClick = initiallyCollapsed ? 'false' : 'true';
            await waitForAttribute(page, groupHeaderSelector, 'data-collapsed', expectedAfterClick);

            // Verify state changed
            const afterClickCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            // State should have toggled
            expect(afterClickCollapsed).toBe(!initiallyCollapsed);

            // Click again to toggle back
            await page.click(groupHeaderSelector);

            // Wait for data-collapsed to return to initial state
            const expectedFinal = initiallyCollapsed ? 'true' : 'false';
            await waitForAttribute(page, groupHeaderSelector, 'data-collapsed', expectedFinal);

            const finalCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            // Should be back to initial state
            expect(finalCollapsed).toBe(initiallyCollapsed);
        } finally {
            // Cleanup
            try {
                if (createdTabIds.length > 0) {
                    await page.evaluate((ids) => {
                        return new Promise(resolve => {
                            chrome.tabs.remove(ids, resolve);
                        });
                    }, createdTabIds);
                }
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 90000);

    test('should show/hide group content when toggling', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        // Create tabs
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
            // Create group
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
            await page.waitForSelector('.tab-group-header');

            const groupHeaderSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupHeaderSelector);

            // Get initial collapsed state
            const initiallyCollapsed = await page.$eval(groupHeaderSelector, el => {
                return el.dataset.collapsed === 'true';
            });

            // Toggle group by clicking header
            await page.click(groupHeaderSelector);

            // Wait for data-collapsed attribute to change
            const expectedAfterToggle = initiallyCollapsed ? 'false' : 'true';
            await waitForAttribute(page, groupHeaderSelector, 'data-collapsed', expectedAfterToggle);

            // Check visibility after toggle
            const afterToggleVisible = await page.$eval(groupHeaderSelector, el => {
                const content = el.nextElementSibling;
                return content && window.getComputedStyle(content).display !== 'none';
            });

            // Visibility should have changed (if initially collapsed, now visible; if initially visible, now hidden)
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
            try { await page.close(); } catch (e) { }
        }
    }, 90000);
}, 240000);
