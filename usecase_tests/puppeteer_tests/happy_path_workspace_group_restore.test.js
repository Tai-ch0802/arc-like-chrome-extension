const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * Batch C E2E: switching workspaces rebuilds the captured tab group.
 *
 * SAFETY: switchWorkspace() closes ALL tabs in the window it targets and
 * reopens the snapshot. To avoid destabilizing the Puppeteer-controlled
 * sidepanel page (which lives in the ORIGINAL window), every workspace
 * operation here targets a SEPARATE window we create ourselves. The
 * controlling page's window id is never passed to switchWorkspace, so its
 * tabs are never touched. The scratch window is always cleaned up in finally.
 *
 * The sidepanel dev build loads sidepanel.js as an unbundled ES module, so we
 * can dynamic-import the real workspaceManager module from the page context
 * and exercise the genuine switchWorkspace wiring (not a reimplementation).
 */
describe('Happy Path: tab group restored on workspace switch', () => {
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

    test('grouped tabs are regrouped after switching away and back', async () => {
        let scratchWindowId = null;
        try {
            const result = await page.evaluate(async () => {
                const ws = await import('./modules/workspace/workspaceManager.js');
                await ws.initWorkspaces();

                // 1) Open a dedicated scratch window with two http tabs.
                const win = await chrome.windows.create({
                    url: ['https://example.com/', 'https://example.org/'],
                    focused: false,
                });
                const windowId = win.id;

                const poll = async (fn, attempts = 100, interval = 100) => {
                    for (let i = 0; i < attempts; i++) {
                        const v = await fn();
                        if (v) return v;
                        await new Promise(r => setTimeout(r, interval));
                    }
                    return null;
                };

                // Wait until both tabs exist AND have a SETTLED http url. The
                // snapshot filters on tab.url (not pendingUrl), so grouping /
                // snapshotting before the url settles is the core race that makes
                // a naive version of this test flaky. Block on it deterministically.
                const httpTabs = await poll(async () => {
                    const t = await chrome.tabs.query({ windowId });
                    const ready = t.filter(x => /^https?:/i.test(x.url || ''));
                    return ready.length >= 2 ? ready : null;
                });
                if (!httpTabs) throw new Error('scratch tabs did not settle');
                const groupTabIds = httpTabs.slice(0, 2).map(t => t.id);

                // 2) Put those tabs into a named, coloured group, then wait until
                //    Chrome reports BOTH tabs carrying the groupId before snapshotting.
                const groupId = await chrome.tabs.group({
                    tabIds: groupTabIds,
                    createProperties: { windowId },
                });
                await chrome.tabGroups.update(groupId, { title: 'BatchC', color: 'cyan' });
                const grouped = await poll(async () => {
                    const t = await chrome.tabs.query({ windowId, groupId });
                    return t.length >= 2 ? t : null;
                });
                if (!grouped) throw new Error('tabs did not join group');

                // 3) Snapshot the scratch window into workspace A, bind it.
                const wsA = await ws.createWorkspace({
                    name: 'GroupRestore A ' + Date.now(),
                    snapshotWindowId: windowId,
                });
                await ws.setActiveWorkspace(windowId, wsA.id);

                // 4) Create an empty workspace B to switch to (forces A's tabs to
                //    be hibernated and the window emptied/reopened).
                const wsB = await ws.createWorkspace({ name: 'GroupRestore B ' + Date.now() });

                // 5) Switch B (away from A), then back to A — restoring A's snapshot,
                //    which must rebuild the captured tab group.
                const switchedAway = await ws.switchWorkspace(wsB.id, windowId);
                const switchedBack = await ws.switchWorkspace(wsA.id, windowId);

                // Deterministically wait for the rebuilt group to appear rather
                // than sleeping a fixed amount.
                const groupsAfter = await poll(async () => {
                    const g = await chrome.tabGroups.query({ windowId });
                    return g.some(x => x.title === 'BatchC') ? g : null;
                }) || await chrome.tabGroups.query({ windowId });
                const tabsAfter = await chrome.tabs.query({ windowId });

                return {
                    windowId,
                    wsAId: wsA.id,
                    wsBId: wsB.id,
                    snapshotGroupCount: wsA.tabSnapshot.filter(s => s.groupKey != null).length,
                    snapshotGroupTitle: (wsA.tabSnapshot.find(s => s.groupKey != null) || {}).groupTitle,
                    switchedAway,
                    switchedBack,
                    groupsAfter: groupsAfter.map(g => ({ title: g.title, color: g.color })),
                    httpTabCount: tabsAfter.filter(t => /^https?:/i.test(t.url || t.pendingUrl || '')).length,
                };
            });

            scratchWindowId = result.windowId;

            // The snapshot must have captured the group on the two grouped tabs.
            expect(result.snapshotGroupCount).toBe(2);
            expect(result.snapshotGroupTitle).toBe('BatchC');

            // Both switches succeeded.
            expect(result.switchedAway).toBe(true);
            expect(result.switchedBack).toBe(true);

            // After restoring workspace A, the group must be rebuilt.
            const restored = result.groupsAfter.find(g => g.title === 'BatchC');
            expect(restored).toBeDefined();
            expect(restored.color).toBe('cyan');
            expect(result.httpTabCount).toBeGreaterThanOrEqual(2);
        } finally {
            if (scratchWindowId != null) {
                try {
                    await page.evaluate((id) => new Promise(resolve => {
                        try { chrome.windows.remove(id, () => resolve()); }
                        catch (_) { resolve(); }
                    }), scratchWindowId);
                } catch (_) { /* window may already be gone */ }
            }
        }
    }, 120000);
});
