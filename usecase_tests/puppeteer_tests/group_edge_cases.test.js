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
            try {
                await page.evaluate(() => {
                    chrome.tabs.query({}, (tabs) => {
                        const targets = tabs.filter(t => t.url.includes('group-color'));
                        if (targets.length > 0) chrome.tabs.remove(targets.map(t => t.id));
                    });
                });
            } catch (e) { }
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
            try {
                await page.evaluate(() => {
                    chrome.tabs.query({}, (tabs) => {
                        const targets = tabs.filter(t => t.url.includes('group-empty'));
                        if (targets.length > 0) chrome.tabs.remove(targets.map(t => t.id));
                    });
                });
            } catch (e) { }
            try { await page.close(); } catch (e) { /* intentionally ignored - cleanup only */ }
        }
    }, 60000);

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
            const tabId = tab.id;

            groupId = await page.evaluate((tId) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds: [tId] }, id => {
                        chrome.tabGroups.update(id, { title: 'Old Title', color: 'grey' }, () => resolve(id));
                    });
                });
            }, tabId);

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
                await page.evaluate(() => {
                    chrome.tabs.query({}, (tabs) => {
                        const targets = tabs.filter(t => t.url.includes('rename'));
                        if (targets.length > 0) chrome.tabs.remove(targets.map(t => t.id));
                    });
                });
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

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

            groupId = await page.evaluate((tId) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds: [tId] }, id => {
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
                if (!header) return false;
                const content = header.nextElementSibling;
                const tab = document.querySelector(`.tab-item[data-tab-id="${tId}"]`);
                return content && content.contains(tab);
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
                await page.evaluate(() => {
                    chrome.tabs.query({}, (tabs) => {
                        const targets = tabs.filter(t => t.url.includes('example.com/g1') || t.url.includes('example.com/g2'));
                        if (targets.length > 0) chrome.tabs.remove(targets.map(t => t.id));
                    });
                });
            } catch (e) { }
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should display groups from other windows correctly', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        await page.waitForSelector('#tab-list');

        let otherWindowId;
        let groupId;
        try {
            // Create a second window with 2 tabs initially
            const otherWindow = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.windows.create({
                        url: ['https://example.com/other-window', 'https://example.com/other-group-tab'],
                        focused: true
                    }, resolve);
                });
            });
            otherWindowId = otherWindow.id;

            // Wait for tabs to be ready in the new window
            await page.waitForFunction(
                (winId) => {
                    return new Promise(resolve => {
                        chrome.tabs.query({ windowId: winId }, (tabs) => {
                            // Wait until tabs have loaded their URLs
                            resolve(tabs.length >= 2 && tabs.every(t => t.url && t.url.includes('example.com')));
                        });
                    });
                },
                { timeout: 15000 },
                otherWindowId
            );

            // Group the second tab
            groupId = await page.evaluate((winId) => {
                return new Promise(resolve => {
                    chrome.tabs.query({ windowId: winId }, (tabs) => {
                        const targetTab = tabs.find(t => t.url.includes('other-group-tab'));
                        if (!targetTab) { resolve(null); return; }

                        // Explicitly specify windowId to prevent tab moving to current window
                        chrome.tabs.group({ tabIds: targetTab.id, createProperties: { windowId: winId } }, (gid) => {
                            chrome.tabGroups.update(gid, { title: 'Other Window Group', color: 'cyan' }, () => {
                                resolve(gid);
                            });
                        });
                    });
                });
            }, otherWindowId);

            // Verify group was created
            if (!groupId) {
                throw new Error('Failed to create group in other window');
            }

            // Force reload to ensure we get the latest state of other windows/tabs/groups
            await page.reload();
            await page.waitForSelector('#tab-list'); // Wait for main content to load

            // Expand "Other Windows" section
            const windowFolderSelector = '#other-windows-list .window-folder';
            await page.waitForSelector(windowFolderSelector, { timeout: 15000 });
            await page.$eval(windowFolderSelector, el => el.click());

            // Wait for content expansion
            await page.waitForFunction(() => {
                const el = document.querySelector('#other-windows-list .folder-content');
                return el && el.style.display !== 'none';
            }, { timeout: 10000 });

            // Wait for the group header to appear in the other window list
            // Increase timeout for cross-window rendering
            await page.waitForFunction((title) => {
                const elements = Array.from(document.querySelectorAll('#other-windows-list .tab-group-title'));
                return elements.some(el => el.textContent === title);
            }, { timeout: 30000 }, 'Other Window Group');

            // Verify
            const groupVisible = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('#other-windows-list .tab-group-title'));
                return elements.some(el => el.textContent === 'Other Window Group');
            });
            expect(groupVisible).toBe(true);

        } finally {
            if (otherWindowId) {
                try {
                    await page.evaluate((id) => chrome.windows.remove(id), otherWindowId);
                } catch (e) { }
            }
            try { await page.close(); } catch (e) { }
        }
    }, 90000);
});
