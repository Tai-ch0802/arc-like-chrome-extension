const { setupBrowser, teardownBrowser } = require('./setup');

describe('Add Tab to Group Use Case', () => {
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

    test('should add an ungrouped tab to an existing group via Chrome API', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        const createdTabIds = [];

        // Create tabs for the group
        for (let i = 0; i < 2; i++) {
            const newTab = await page.evaluate((index) => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: `https://example.com/group-member-${index}`,
                        active: false
                    }, resolve);
                });
            }, i);
            createdTabIds.push(newTab.id);
        }

        // Create an ungrouped tab
        const ungroupedTab = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.tabs.create({
                    url: 'https://example.com/ungrouped-tab',
                    active: false
                }, resolve);
            });
        });
        createdTabIds.push(ungroupedTab.id);

        let groupId;
        try {
            // Create a group with first 2 tabs
            groupId = await page.evaluate((tabIds) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds }, resolve);
                });
            }, [createdTabIds[0], createdTabIds[1]]);

            await page.evaluate((gId) => {
                return new Promise(resolve => {
                    chrome.tabGroups.update(gId, { title: 'Target Group' }, resolve);
                });
            }, groupId);

            // Verify ungrouped tab is not in the group
            const tabBeforeAdd = await page.evaluate((tabId) => {
                return new Promise(resolve => {
                    chrome.tabs.get(tabId, tab => resolve(tab));
                });
            }, ungroupedTab.id);
            expect(tabBeforeAdd.groupId).toBe(-1); // -1 means ungrouped

            // Add the ungrouped tab to the group via Chrome API
            await page.evaluate(({ tabId, groupId }) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds: [tabId], groupId }, resolve);
                });
            }, { tabId: ungroupedTab.id, groupId });

            // Verify tab is now in the group
            const tabAfterAdd = await page.evaluate((tabId) => {
                return new Promise(resolve => {
                    chrome.tabs.get(tabId, tab => resolve(tab));
                });
            }, ungroupedTab.id);
            expect(tabAfterAdd.groupId).toBe(groupId);

            // Reload and verify UI reflects the change
            await page.reload();
            await page.waitForSelector('.tab-group-header');

            // The tab should now be inside the group container (sibling of header)
            const groupHeaderSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            const tabInGroup = await page.$eval(groupHeaderSelector, (header, tabId) => {
                const content = header.nextElementSibling;
                return content && content.querySelector(`.tab-item[data-tab-id="${tabId}"]`) !== null;
            }, ungroupedTab.id);
            expect(tabInGroup).toBe(true);
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

    test('should create a new group when grouping ungrouped tabs', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        const createdTabIds = [];

        // Create ungrouped tabs
        for (let i = 0; i < 2; i++) {
            const newTab = await page.evaluate((index) => {
                return new Promise(resolve => {
                    chrome.tabs.create({
                        url: `https://example.com/new-group-${index}`,
                        active: false
                    }, resolve);
                });
            }, i);
            createdTabIds.push(newTab.id);
        }

        let groupId;
        try {
            // Get initial group count
            const initialGroups = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabGroups.query({}, groups => resolve(groups));
                });
            });
            const initialGroupCount = initialGroups.length;

            // Create a new group with these tabs
            groupId = await page.evaluate((tabIds) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds }, resolve);
                });
            }, createdTabIds);

            // Verify a new group was created
            const finalGroups = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabGroups.query({}, groups => resolve(groups));
                });
            });
            expect(finalGroups.length).toBe(initialGroupCount + 1);

            // Verify the tabs are in the new group
            for (const tabId of createdTabIds) {
                const tab = await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.tabs.get(id, tab => resolve(tab));
                    });
                }, tabId);
                expect(tab.groupId).toBe(groupId);
            }
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
