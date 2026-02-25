const { setupBrowser, teardownBrowser } = require('./setup');

describe('Search Group Auto-Expand', () => {
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

    /**
     * Helper: clean up test tabs by URL pattern
     */
    async function cleanupTestTabs(urlPattern) {
        try {
            await page.evaluate((pattern) => {
                chrome.tabs.query({}, (tabs) => {
                    const targets = tabs.filter(t => t.url && t.url.includes(pattern));
                    if (targets.length > 0) chrome.tabs.remove(targets.map(t => t.id));
                });
            }, urlPattern);
        } catch (e) { /* cleanup best-effort */ }
    }

    /**
     * Helper: clear the search box and trigger input event to reset search state
     */
    async function clearSearch() {
        await page.evaluate(() => {
            const searchBox = document.getElementById('search-box');
            if (searchBox) {
                searchBox.value = '';
                searchBox.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        // Wait for all tab items to be visible again
        await page.waitForFunction(() => {
            const hidden = document.querySelectorAll('.tab-item.hidden');
            return hidden.length === 0;
        }, { timeout: 15000 }).catch(() => { });
    }

    test('should auto-expand collapsed group when search matches a tab inside', async () => {
        let groupId;
        const createdTabIds = [];

        try {
            // Create 2 tabs and group them
            for (let i = 0; i < 2; i++) {
                const tab = await page.evaluate((index) => {
                    return new Promise(resolve => {
                        chrome.tabs.create({
                            url: `data:text/html,<title>search-expand-test-${index}</title>`,
                            active: false
                        }, resolve);
                    });
                }, i);
                createdTabIds.push(tab.id);
            }

            // Group the tabs
            groupId = await page.evaluate((tabIds) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds }, resolve);
                });
            }, createdTabIds);

            // Name the group and collapse it
            await page.evaluate((gId) => {
                return new Promise(resolve => {
                    chrome.tabGroups.update(gId, { title: 'Expand Test Group', collapsed: true }, resolve);
                });
            }, groupId);

            // Reload to ensure collapsed state is rendered
            await page.reload();
            await page.waitForSelector('#tab-list', { timeout: 15000 });

            const groupHeaderSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupHeaderSelector, { timeout: 10000 });

            // Verify group is initially collapsed (content display is 'none')
            const initiallyHidden = await page.$eval(groupHeaderSelector, el => {
                const content = el.nextElementSibling;
                return content && window.getComputedStyle(content).display === 'none';
            });
            expect(initiallyHidden).toBe(true);

            // Search for the tab title inside the group
            await page.type('#search-box', 'search-expand-test');

            // Wait for search to process and group content to become visible
            await page.waitForFunction((selector) => {
                const header = document.querySelector(selector);
                if (!header) return false;
                const content = header.nextElementSibling;
                return content && window.getComputedStyle(content).display !== 'none';
            }, { timeout: 15000 }, groupHeaderSelector);

            // Verify group content is now visible
            const isVisible = await page.$eval(groupHeaderSelector, el => {
                const content = el.nextElementSibling;
                return content && window.getComputedStyle(content).display !== 'none';
            });
            expect(isVisible).toBe(true);

            // Verify the matching tab is visible (not hidden)
            const matchingTabVisible = await page.evaluate((tabId) => {
                const tabEl = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
                return tabEl && !tabEl.classList.contains('hidden');
            }, createdTabIds[0]);
            expect(matchingTabVisible).toBe(true);

        } finally {
            await clearSearch();
            await cleanupTestTabs('search-expand-test');
            if (groupId) {
                await page.waitForFunction(
                    (sel) => !document.querySelector(sel),
                    { timeout: 10000 },
                    `.tab-group-header[data-group-id="${groupId}"]`
                ).catch(() => { });
            }
        }
    }, 60000);

    test('should restore collapsed state when search is cleared', async () => {
        let groupId;
        const createdTabIds = [];

        try {
            // Create 2 tabs and group them
            for (let i = 0; i < 2; i++) {
                const tab = await page.evaluate((index) => {
                    return new Promise(resolve => {
                        chrome.tabs.create({
                            url: `data:text/html,<title>restore-collapse-test-${index}</title>`,
                            active: false
                        }, resolve);
                    });
                }, i);
                createdTabIds.push(tab.id);
            }

            // Group and collapse
            groupId = await page.evaluate((tabIds) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds }, resolve);
                });
            }, createdTabIds);

            await page.evaluate((gId) => {
                return new Promise(resolve => {
                    chrome.tabGroups.update(gId, { title: 'Restore Test Group', collapsed: true }, resolve);
                });
            }, groupId);

            await page.reload();
            await page.waitForSelector('#tab-list', { timeout: 15000 });

            const groupHeaderSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupHeaderSelector, { timeout: 10000 });

            // Search to expand
            await page.type('#search-box', 'restore-collapse-test');

            // Wait for expansion
            await page.waitForFunction((selector) => {
                const header = document.querySelector(selector);
                if (!header) return false;
                const content = header.nextElementSibling;
                return content && window.getComputedStyle(content).display !== 'none';
            }, { timeout: 15000 }, groupHeaderSelector);

            // Clear search
            await clearSearch();

            // Wait for group content to collapse again
            await page.waitForFunction((selector) => {
                const header = document.querySelector(selector);
                if (!header) return false;
                const content = header.nextElementSibling;
                return content && window.getComputedStyle(content).display === 'none';
            }, { timeout: 15000 }, groupHeaderSelector);

            // Verify group is collapsed again
            const isCollapsedAgain = await page.$eval(groupHeaderSelector, el => {
                const content = el.nextElementSibling;
                return content && window.getComputedStyle(content).display === 'none';
            });
            expect(isCollapsedAgain).toBe(true);

            // Verify arrow is ▶
            const arrow = await page.$eval(groupHeaderSelector + ' .tab-group-arrow', el => el.textContent);
            expect(arrow).toBe('▶');

        } finally {
            await clearSearch();
            await cleanupTestTabs('restore-collapse-test');
            if (groupId) {
                await page.waitForFunction(
                    (sel) => !document.querySelector(sel),
                    { timeout: 10000 },
                    `.tab-group-header[data-group-id="${groupId}"]`
                ).catch(() => { });
            }
        }
    }, 60000);
});
