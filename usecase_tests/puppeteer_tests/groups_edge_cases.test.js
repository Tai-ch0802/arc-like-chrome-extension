const { setupBrowser, teardownBrowser } = require('./setup');

describe('Groups Edge Cases', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close();
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should update group color indicator when color changes', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        let groupId;
        try {
            // Create tab and group
            const tab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/color', active: false }, resolve);
                });
            });

            groupId = await page.evaluate((tabId) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds: [tabId] }, id => {
                         chrome.tabGroups.update(id, { title: 'Color Test', color: 'blue' }, () => resolve(id));
                    });
                });
            }, tab.id);

            await page.waitForSelector(`.tab-group-header[data-group-id="${groupId}"]`);

            // Check initial color (blue)
            const initialColor = await page.$eval(`.tab-group-header[data-group-id="${groupId}"] .tab-group-color-dot`, el => el.style.backgroundColor);

            // Change to red
            await page.evaluate((id) => {
                return new Promise(resolve => {
                     chrome.tabGroups.update(parseInt(id), { color: 'red' }, resolve);
                });
            }, groupId);

            // Wait for update
            await page.waitForFunction((id, oldColor) => {
                const el = document.querySelector(`.tab-group-header[data-group-id="${id}"] .tab-group-color-dot`);
                return el && el.style.backgroundColor !== oldColor;
            }, {}, groupId, initialColor);

            const newColor = await page.$eval(`.tab-group-header[data-group-id="${groupId}"] .tab-group-color-dot`, el => el.style.backgroundColor);

            expect(newColor).not.toBe(initialColor);

        } finally {
             try {
                if (groupId) {
                    const tabs = await page.evaluate((gId) => {
                        return new Promise(resolve => {
                            chrome.tabs.query({ groupId: gId }, resolve);
                        });
                    }, groupId);
                    const ids = tabs.map(t => t.id);
                    if (ids.length > 0) {
                         await page.evaluate((ids) => {
                             return new Promise(resolve => chrome.tabs.remove(ids, resolve));
                         }, ids);
                    }
                }
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 30000);

    test('should update group title when renamed', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        let groupId;
        try {
            const tab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/rename', active: false }, resolve);
                });
            });

            groupId = await page.evaluate((tabId) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds: [tabId] }, id => {
                         chrome.tabGroups.update(id, { title: 'Old Title', color: 'grey' }, () => resolve(id));
                    });
                });
            }, tab.id);

            await page.waitForSelector(`.tab-group-header[data-group-id="${groupId}"]`);

            // Verify old title
            const oldTitle = await page.$eval(`.tab-group-header[data-group-id="${groupId}"] .tab-group-title`, el => el.textContent);
            expect(oldTitle).toBe('Old Title');

            // Rename
            await page.evaluate((id) => {
                return new Promise(resolve => {
                     chrome.tabGroups.update(parseInt(id), { title: 'New Title' }, resolve);
                });
            }, groupId);

            // Wait for update
            await page.waitForFunction((id) => {
                const el = document.querySelector(`.tab-group-header[data-group-id="${id}"] .tab-group-title`);
                return el && el.textContent === 'New Title';
            }, {}, groupId);

            const newTitle = await page.$eval(`.tab-group-header[data-group-id="${groupId}"] .tab-group-title`, el => el.textContent);
            expect(newTitle).toBe('New Title');

        } finally {
             try {
                if (groupId) {
                     const tabs = await page.evaluate((gId) => {
                        return new Promise(resolve => {
                            chrome.tabs.query({ groupId: gId }, resolve);
                        });
                    }, groupId);
                    const ids = tabs.map(t => t.id);
                    if (ids.length > 0) {
                         await page.evaluate((ids) => {
                             return new Promise(resolve => chrome.tabs.remove(ids, resolve));
                         }, ids);
                    }
                }
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 30000);

    test('should move tab into group via API', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        let groupId;
        let tabId2;
        try {
            // Create tab1 and group
            const tab1 = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/g1', active: false }, resolve);
                });
            });

            groupId = await page.evaluate((tabId) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds: [tabId] }, id => {
                         chrome.tabGroups.update(id, { title: 'Move Target', color: 'green' }, () => resolve(id));
                    });
                });
            }, tab1.id);

            // Create tab2 (independent)
             const tab2 = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/g2', active: false }, resolve);
                });
            });
            tabId2 = tab2.id;

            await page.waitForSelector(`.tab-group-header[data-group-id="${groupId}"]`);
            await page.waitForSelector(`.tab-item[data-tab-id="${tabId2}"]`);

            // Verify tab2 is NOT in group
            const isInsideGroup = await page.evaluate((gId, tId) => {
                const header = document.querySelector(`.tab-group-header[data-group-id="${gId}"]`);
                const content = header.nextElementSibling;
                const tab = document.querySelector(`.tab-item[data-tab-id="${tId}"]`);
                return content.contains(tab);
            }, groupId, tabId2);
            expect(isInsideGroup).toBe(false);

            // Move tab2 into group
            await page.evaluate((gId, tId) => {
                 return new Promise(resolve => {
                     chrome.tabs.group({ tabIds: [tId], groupId: gId }, resolve);
                 });
            }, groupId, tabId2);

            // Wait for update (tab2 should be inside group content)
             await page.waitForFunction((gId, tId) => {
                const header = document.querySelector(`.tab-group-header[data-group-id="${gId}"]`);
                const content = header && header.nextElementSibling;
                const tab = document.querySelector(`.tab-item[data-tab-id="${tId}"]`);
                return content && tab && content.contains(tab);
             }, {}, groupId, tabId2);

             const isNowInsideGroup = await page.evaluate((gId, tId) => {
                const header = document.querySelector(`.tab-group-header[data-group-id="${gId}"]`);
                const content = header.nextElementSibling;
                const tab = document.querySelector(`.tab-item[data-tab-id="${tId}"]`);
                return content.contains(tab);
            }, groupId, tabId2);
            expect(isNowInsideGroup).toBe(true);

        } finally {
             try {
                if (groupId) {
                     const tabs = await page.evaluate((gId) => {
                        return new Promise(resolve => {
                            chrome.tabs.query({ groupId: gId }, resolve);
                        });
                    }, groupId);
                    const ids = tabs.map(t => t.id);
                    if (ids.length > 0) {
                         await page.evaluate((ids) => {
                             return new Promise(resolve => chrome.tabs.remove(ids, resolve));
                         }, ids);
                    }
                }
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 30000);
});
