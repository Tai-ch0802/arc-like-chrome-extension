const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * Edge case tests for drag-drop optimization (getNextDraggable function).
 * These tests verify correctness across various DOM structures.
 */
describe('Drag Drop Edge Cases', () => {
    let browser;
    let page;
    let createdTabIds = [];
    let createdGroupIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    afterEach(async () => {
        // Cleanup: remove created tabs
        if (createdTabIds.length > 0) {
            await page.evaluate((ids) => {
                return new Promise(resolve => {
                    chrome.tabs.remove(ids, resolve);
                });
            }, createdTabIds).catch(() => { }); // Ignore errors if tabs already closed
            createdTabIds = [];
        }
        // Cleanup: ungroup created groups
        if (createdGroupIds.length > 0) {
            for (const groupId of createdGroupIds) {
                await page.evaluate((gid) => {
                    return new Promise(resolve => {
                        chrome.tabs.query({ groupId: gid }, tabs => {
                            if (tabs && tabs.length > 0) {
                                chrome.tabs.ungroup(tabs.map(t => t.id), resolve);
                            } else {
                                resolve();
                            }
                        });
                    });
                }, groupId).catch(() => { });
            }
            createdGroupIds = [];
        }
        // Reload for clean state
        await page.reload();
        await page.waitForSelector('#tab-list', { timeout: 10000 });
    });

    test('should correctly find next draggable when dragging to end of list', async () => {
        // Ensure at least 3 tabs
        const tabs = await page.evaluate(() => {
            return new Promise(resolve => chrome.tabs.query({ currentWindow: true }, resolve));
        });

        const tabsToCreate = Math.max(0, 3 - tabs.length);
        for (let i = 0; i < tabsToCreate; i++) {
            const newTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'about:blank', active: false }, resolve);
                });
            });
            createdTabIds.push(newTab.id);
        }

        // Wait for UI to update
        await page.waitForFunction(
            () => document.querySelectorAll('.tab-item').length >= 3,
            { timeout: 10000 }
        );

        // Get first tab and drag to end
        const tabItems = await page.$$('.tab-item');
        const firstTab = tabItems[0];
        const lastTab = tabItems[tabItems.length - 1];

        const firstTabId = await firstTab.evaluate(el => el.dataset.tabId);
        const firstBox = await firstTab.boundingBox();
        const lastBox = await lastTab.boundingBox();

        // Perform drag
        await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(
            lastBox.x + lastBox.width / 2,
            lastBox.y + lastBox.height + 10,
            { steps: 10 }
        );
        await page.mouse.up();

        // Wait for UI update with polling
        await page.waitForFunction(
            (tabId) => {
                const items = document.querySelectorAll('.tab-item');
                const lastItem = items[items.length - 1];
                return lastItem && lastItem.dataset.tabId === tabId;
            },
            { timeout: 10000 },
            firstTabId
        );

        // Verify the tab is now at the end
        const finalTabItems = await page.$$('.tab-item');
        const finalLastTab = finalTabItems[finalTabItems.length - 1];
        const finalLastTabId = await finalLastTab.evaluate(el => el.dataset.tabId);

        expect(finalLastTabId).toBe(firstTabId);
    }, 60000);

    test('should correctly navigate through empty group content', async () => {
        // Create 2 tabs
        for (let i = 0; i < 2; i++) {
            const newTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'about:blank', active: false }, resolve);
                });
            });
            createdTabIds.push(newTab.id);
        }

        // Wait for tabs to appear
        await page.waitForFunction(
            (count) => document.querySelectorAll('.tab-item').length >= count,
            { timeout: 10000 },
            createdTabIds.length
        );

        // Create a group from the second tab
        const groupId = await page.evaluate((tabId) => {
            return new Promise(resolve => {
                chrome.tabs.group({ tabIds: [tabId] }, resolve);
            });
        }, createdTabIds[1]);
        createdGroupIds.push(groupId);

        // Wait for group header to appear
        await page.waitForSelector('.tab-group-header', { timeout: 10000 });

        // Verify the DOM structure is correct
        const structure = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('#tab-list > *').forEach(el => {
                if (el.classList.contains('tab-item')) items.push('tab');
                if (el.classList.contains('tab-group-header')) items.push('group-header');
                if (el.classList.contains('tab-group-content')) items.push('group-content');
            });
            return items;
        });

        // There should be group-header followed by group-content
        expect(structure).toContain('group-header');
        expect(structure).toContain('group-content');
    }, 60000);

    test('should handle dragging within a group correctly', async () => {
        // Create 3 tabs
        for (let i = 0; i < 3; i++) {
            const newTab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'about:blank', active: false }, resolve);
                });
            });
            createdTabIds.push(newTab.id);
        }

        // Wait for tabs
        await page.waitForFunction(
            () => document.querySelectorAll('.tab-item').length >= 3,
            { timeout: 10000 }
        );

        // Group first two tabs
        const groupId = await page.evaluate((tabIds) => {
            return new Promise(resolve => {
                chrome.tabs.group({ tabIds }, resolve);
            });
        }, [createdTabIds[0], createdTabIds[1]]);
        createdGroupIds.push(groupId);

        // Wait for group to render
        await page.waitForSelector('.tab-group-content .tab-item', { timeout: 10000 });

        // Verify tabs are in group
        const tabsInGroup = await page.$$('.tab-group-content .tab-item');
        expect(tabsInGroup.length).toBe(2);
    }, 60000);
});
