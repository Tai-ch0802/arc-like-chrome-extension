const { setupBrowser, teardownBrowser, waitForElementRemoved } = require('./setup');

describe('Group Edge Cases', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        // Wait for initial app load
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

    test('should update UI when group color changes', async () => {
        let groupId;
        try {
            // Create a tab and group it
            const result = await page.evaluate(async () => {
                const tab = await new Promise(resolve => chrome.tabs.create({ url: 'https://example.com/group-color', active: false }, resolve));
                const groupId = await new Promise(resolve => chrome.tabs.group({ tabIds: tab.id }, resolve));
                await new Promise(resolve => chrome.tabGroups.update(groupId, { title: 'Color Test', color: 'blue' }, resolve));
                return { groupId, tabId: tab.id };
            });
            groupId = result.groupId;

            // Wait for group render
            const dotSelector = `.tab-group-header[data-group-id="${groupId}"] .tab-group-color-dot`;
            await page.waitForSelector(dotSelector, { timeout: 10000 });

            // Get initial color before changing
            const initialColor = await page.$eval(dotSelector, el => el.style.backgroundColor);

            // Update color to 'red'
            await page.evaluate(async (gid) => {
                await new Promise(resolve => chrome.tabGroups.update(gid, { color: 'red' }, resolve));
            }, groupId);

            // Wait for color to change
            await page.waitForFunction(
                (selector, oldColor) => {
                    const el = document.querySelector(selector);
                    return el && el.style.backgroundColor !== oldColor;
                },
                { timeout: 10000 },
                dotSelector,
                initialColor
            );

            // Verify the color changed
            const newColor = await page.$eval(dotSelector, el => el.style.backgroundColor);
            expect(newColor).not.toBe(initialColor);
            expect(newColor).toBeTruthy();

        } finally {
            await cleanupTestTabs('group-color');
            // Wait for tab removal to reflect in DOM
            if (groupId) {
                await waitForElementRemoved(page, `.tab-group-header[data-group-id="${groupId}"]`).catch(() => { });
            }
        }
    }, 30000);

    test('should remove group header when group becomes empty', async () => {
        let groupId, tabId;
        try {
            const result = await page.evaluate(async () => {
                const tab = await new Promise(resolve => chrome.tabs.create({ url: 'https://example.com/group-empty', active: false }, resolve));
                const groupId = await new Promise(resolve => chrome.tabs.group({ tabIds: tab.id }, resolve));
                await new Promise(resolve => chrome.tabGroups.update(groupId, { title: 'Empty Test' }, resolve));
                return { groupId, tabId: tab.id };
            });
            groupId = result.groupId;
            tabId = result.tabId;

            // Wait for group render
            const groupSelector = `.tab-group-header[data-group-id="${groupId}"]`;
            await page.waitForSelector(groupSelector, { timeout: 10000 });

            // Ungroup the tab
            await page.evaluate(async (tid) => {
                await new Promise(resolve => chrome.tabs.ungroup(tid, resolve));
            }, tabId);

            // Wait for group header to be removed
            await waitForElementRemoved(page, groupSelector);

            // Verify group header is gone
            const groupExists = await page.$(groupSelector);
            expect(groupExists).toBeNull();

        } finally {
            await cleanupTestTabs('group-empty');
        }
    }, 30000);

    test('should update group title when renamed', async () => {
        let groupId;
        try {
            const tab = await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.tabs.create({ url: 'https://example.com/rename', active: false }, resolve);
                });
            });

            groupId = await page.evaluate((tId) => {
                return new Promise(resolve => {
                    chrome.tabs.group({ tabIds: [tId] }, id => {
                        chrome.tabGroups.update(id, { title: 'Old Title', color: 'grey' }, () => resolve(id));
                    });
                });
            }, tab.id);

            await page.waitForFunction(
                (id) => {
                    const el = document.querySelector(`.tab-group-header[data-group-id="${id}"] .tab-group-title`);
                    return el && el.textContent === 'Old Title';
                },
                { timeout: 10000 },
                groupId
            );

            // Verify old title
            const oldTitle = await page.$eval(`.tab-group-header[data-group-id="${groupId}"] .tab-group-title`, el => el.textContent);
            expect(oldTitle).toBe('Old Title');

            // Rename
            await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.tabGroups.update(parseInt(id), { title: 'New Title' }, resolve);
                });
            }, groupId);

            // Wait for update (with reload fallback for slow VMs)
            try {
                await page.waitForFunction((id) => {
                    const el = document.querySelector(`.tab-group-header[data-group-id="${id}"] .tab-group-title`);
                    return el && el.textContent === 'New Title';
                }, { timeout: 15000 }, groupId);
            } catch (_) {
                // Fallback: reload to force DOM refresh from Chrome API state
                await page.reload();
                await page.waitForSelector('#tab-list', { timeout: 10000 });
                await page.waitForFunction((id) => {
                    const el = document.querySelector(`.tab-group-header[data-group-id="${id}"] .tab-group-title`);
                    return el && el.textContent === 'New Title';
                }, { timeout: 15000 }, groupId);
            }

            const newTitle = await page.$eval(`.tab-group-header[data-group-id="${groupId}"] .tab-group-title`, el => el.textContent);
            expect(newTitle).toBe('New Title');

        } finally {
            await cleanupTestTabs('rename');
            if (groupId) {
                await waitForElementRemoved(page, `.tab-group-header[data-group-id="${groupId}"]`).catch(() => { });
            }
        }
    }, 30000);

    test('should move tab into group via API', async () => {
        let groupId, tabId2;
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

            await page.waitForSelector(`.tab-group-header[data-group-id="${groupId}"]`, { timeout: 10000 });
            await page.waitForSelector(`.tab-item[data-tab-id="${tabId2}"]`, { timeout: 10000 });

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
            }, { timeout: 10000 }, groupId, tabId2);

            const isNowInsideGroup = await page.evaluate((gId, tId) => {
                const header = document.querySelector(`.tab-group-header[data-group-id="${gId}"]`);
                const content = header?.nextElementSibling;
                const tab = document.querySelector(`.tab-item[data-tab-id="${tId}"]`);
                return content?.contains(tab) ?? false;
            }, groupId, tabId2);
            expect(isNowInsideGroup).toBe(true);

        } finally {
            await cleanupTestTabs('example.com/g1');
            await cleanupTestTabs('example.com/g2');
            if (groupId) {
                await waitForElementRemoved(page, `.tab-group-header[data-group-id="${groupId}"]`).catch(() => { });
            }
        }
    }, 30000);

    test('should display groups from other windows correctly', async () => {
        let otherWindowId;
        try {
            // Create a second window with 2 tabs
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
                            resolve(tabs.length >= 2 && tabs.every(t => t.url && t.url.includes('example.com')));
                        });
                    });
                },
                { timeout: 15000 },
                otherWindowId
            );

            // Group the second tab
            const groupId = await page.evaluate((winId) => {
                return new Promise(resolve => {
                    chrome.tabs.query({ windowId: winId }, (tabs) => {
                        const targetTab = tabs.find(t => t.url.includes('other-group-tab'));
                        if (!targetTab) { resolve(null); return; }
                        chrome.tabs.group({ tabIds: targetTab.id, createProperties: { windowId: winId } }, (gid) => {
                            chrome.tabGroups.update(gid, { title: 'Other Window Group', color: 'cyan' }, () => resolve(gid));
                        });
                    });
                });
            }, otherWindowId);

            if (!groupId) throw new Error('Failed to create group in other window');

            // Force reload to get the latest state of other windows
            await page.reload();
            await page.waitForSelector('#tab-list', { timeout: 15000 });

            // Expand "Other Windows" section
            const windowFolderSelector = '#other-windows-list .window-folder';
            await page.waitForSelector(windowFolderSelector, { timeout: 15000 });
            await page.$eval(windowFolderSelector, el => el.click());

            // Wait for content expansion
            await page.waitForFunction(() => {
                const el = document.querySelector('#other-windows-list .folder-content');
                return el && el.style.display !== 'none';
            }, { timeout: 10000 });

            // Wait for the group header
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
        }
    }, 120000);
});
