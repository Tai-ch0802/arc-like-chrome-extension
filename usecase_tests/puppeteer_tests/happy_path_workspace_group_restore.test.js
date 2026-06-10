const { setupBrowser, teardownBrowser } = require('./setup');

/**
 * Batch C E2E: Arc-style workspace switching.
 *
 * switchWorkspace() is NON-DESTRUCTIVE: it never touches the window it is
 * called from. Switching to a workspace with no live window OPENS a new
 * window restoring the snapshot (tab groups rebuilt); switching to one that
 * already has a live window FOCUSES that window. This test exercises both
 * paths plus the group-restore fidelity of the open path.
 *
 * The sidepanel dev build loads sidepanel.js as an unbundled ES module, so we
 * can dynamic-import the real workspaceManager module from the page context
 * and exercise the genuine switchWorkspace wiring (not a reimplementation).
 * Every window this test creates is cleaned up in finally.
 */
describe('Happy Path: Arc-style switch opens/focuses workspace window', () => {
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

    test('switch opens a new window with groups restored, second switch focuses it', async () => {
        const windowIds = [];
        let workspaceId = null;
        try {
            const result = await page.evaluate(async () => {
                const ws = await import('./modules/workspace/workspaceManager.js');
                await ws.initWorkspaces();

                const poll = async (fn, attempts = 100, interval = 100) => {
                    for (let i = 0; i < attempts; i++) {
                        const v = await fn();
                        if (v) return v;
                        await new Promise(r => setTimeout(r, interval));
                    }
                    return null;
                };

                // 1) Scratch window with two http tabs that we snapshot from.
                const scratch = await chrome.windows.create({
                    url: ['https://example.com/', 'https://example.org/'],
                    focused: false,
                });
                const scratchId = scratch.id;

                // Wait until both tabs exist AND have a SETTLED http url. The
                // snapshot filters on tab.url (not pendingUrl), so snapshotting
                // before the url settles is the core race that would make this
                // flaky. Block on it deterministically.
                const httpTabs = await poll(async () => {
                    const t = await chrome.tabs.query({ windowId: scratchId });
                    const ready = t.filter(x => /^https?:/i.test(x.url || ''));
                    return ready.length >= 2 ? ready : null;
                });
                if (!httpTabs) throw new Error('scratch tabs did not settle');
                const groupTabIds = httpTabs.slice(0, 2).map(t => t.id);

                // 2) Put those tabs into a named, coloured group, then wait until
                //    Chrome reports BOTH tabs carrying the groupId before snapshotting.
                const groupId = await chrome.tabs.group({
                    tabIds: groupTabIds,
                    createProperties: { windowId: scratchId },
                });
                await chrome.tabGroups.update(groupId, { title: 'BatchC', color: 'cyan' });
                const grouped = await poll(async () => {
                    const t = await chrome.tabs.query({ windowId: scratchId, groupId });
                    return t.length >= 2 ? t : null;
                });
                if (!grouped) throw new Error('tabs did not join group');

                // 3) Snapshot the scratch window into workspace A (NOT bound),
                //    then close the scratch window — the workspace now has no
                //    live window, like after a browser restart.
                const wsA = await ws.createWorkspace({
                    name: 'ArcSwitch A ' + Date.now(),
                    snapshotWindowId: scratchId,
                });
                await new Promise(resolve => {
                    try { chrome.windows.remove(scratchId, () => resolve()); }
                    catch (_) { resolve(); }
                });

                // 4) OPEN path: switching must create a NEW window restoring the
                //    snapshot, and bind it to the workspace.
                const controlling = await chrome.windows.getCurrent();
                const opened = await ws.switchWorkspace(wsA.id, controlling.id);
                if (!opened || opened.action !== 'opened') {
                    throw new Error('expected opened, got ' + JSON.stringify(opened));
                }
                const openedWindowId = opened.windowId;

                // Group restore is async best-effort after tab creation — wait
                // for the rebuilt group deterministically.
                const groupsAfter = await poll(async () => {
                    const g = await chrome.tabGroups.query({ windowId: openedWindowId });
                    return g.some(x => x.title === 'BatchC') ? g : null;
                }) || await chrome.tabGroups.query({ windowId: openedWindowId });
                const tabsAfter = await chrome.tabs.query({ windowId: openedWindowId });

                // 5) FOCUS path: switching again must NOT open another window —
                //    it focuses the one bound in step 4.
                const focused = await ws.switchWorkspace(wsA.id, controlling.id);

                const mapInStorage = await new Promise(r =>
                    chrome.storage.local.get(['windowWorkspaceMap'], res => r(res.windowWorkspaceMap || {})));

                // The in-memory mirror is EVENTUALLY consistent: the binding
                // write fires storage.onChanged, and the sidepanel's debounced
                // (200ms) reload refreshes the mirror. Storage (asserted via
                // mapInStorage) is the authoritative truth; poll the mirror.
                const boundWorkspaceId = await poll(
                    async () => ws.getActiveWorkspaceId(openedWindowId));

                return {
                    wsId: wsA.id,
                    snapshotGroupCount: wsA.tabSnapshot.filter(s => s.groupKey != null).length,
                    snapshotGroupTitle: (wsA.tabSnapshot.find(s => s.groupKey != null) || {}).groupTitle,
                    openedAction: opened.action,
                    openedWindowId,
                    mapInStorage,
                    boundWorkspaceId,
                    groupsAfter: groupsAfter.map(g => ({ title: g.title, color: g.color })),
                    httpTabCount: tabsAfter.filter(t => /^https?:/i.test(t.url || t.pendingUrl || '')).length,
                    focusedAction: focused && focused.action,
                    focusedWindowId: focused && focused.windowId,
                };
            });

            windowIds.push(result.openedWindowId);
            workspaceId = result.wsId;

            // The snapshot must have captured the group on the two grouped tabs.
            expect(result.snapshotGroupCount).toBe(2);
            expect(result.snapshotGroupTitle).toBe('BatchC');

            // Open path: new window, bound to the workspace, group rebuilt.
            expect(result.openedAction).toBe('opened');
            expect(JSON.stringify(result.mapInStorage)).toContain(result.wsId);
            expect(result.boundWorkspaceId).toBe(result.wsId);
            const restored = result.groupsAfter.find(g => g.title === 'BatchC');
            expect(restored).toBeDefined();
            expect(restored.color).toBe('cyan');
            expect(result.httpTabCount).toBeGreaterThanOrEqual(2);

            // Focus path: same window re-used, no second window opened.
            expect(result.focusedAction).toBe('focused');
            expect(result.focusedWindowId).toBe(result.openedWindowId);
        } finally {
            // Remove the workspace first so windows.onRemoved cleanup has
            // nothing to race with, then close any window we opened.
            try {
                await page.evaluate(async (wsId) => {
                    if (!wsId) return;
                    const ws = await import('./modules/workspace/workspaceManager.js');
                    await ws.initWorkspaces();
                    await ws.deleteWorkspace(wsId);
                }, workspaceId);
            } catch (_) { /* best-effort */ }
            for (const id of windowIds) {
                if (id == null) continue;
                try {
                    await page.evaluate((winId) => new Promise(resolve => {
                        try { chrome.windows.remove(winId, () => resolve()); }
                        catch (_) { resolve(); }
                    }), id);
                } catch (_) { /* window may already be gone */ }
            }
        }
    }, 120000);
});
