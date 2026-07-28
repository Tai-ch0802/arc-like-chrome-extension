// BASE-022 P3 — AI Auto Routing (FR-3.04~3.07).
//
// AI-agnostic by design: the test browser has no Gemini Nano, so
// generateGroupName returns null and the group keeps its DOMAIN placeholder
// title — every assertion here is deterministic without any AI model
// (SA v1.2 upgraded this from local-only to happy_path for that reason).
const { setupBrowser, teardownBrowser } = require('./setup');

describe('AI Auto Routing', () => {
    let browser;
    let page;
    const createdTabIds = [];

    async function createTab(url) {
        const tab = await page.evaluate((u) => chrome.tabs.create({ url: u, active: false }), url);
        createdTabIds.push(tab.id);
        return tab;
    }

    /** Wait until the engine has judged this tab (its first-nav decision ran). */
    async function waitJudged(tabId, timeout = 8000) {
        await page.waitForFunction(async (id) => {
            const s = await chrome.storage.session.get('routingSessionState');
            return !!(s.routingSessionState && s.routingSessionState.judged && s.routingSessionState.judged[id]);
        }, { timeout }, tabId);
    }

    async function groupOf(tabId) {
        return page.evaluate(async (id) => {
            try {
                const t = await chrome.tabs.get(id);
                if (t.groupId === -1) return null;
                const g = await chrome.tabGroups.get(t.groupId);
                return { groupId: g.id, title: g.title };
            } catch (e) {
                return null;
            }
        }, tabId);
    }

    async function assertStaysUngrouped(tabId, windowMs = 1200) {
        const deadline = Date.now() + windowMs;
        while (Date.now() < deadline) {
            expect(await groupOf(tabId)).toBeNull();
            await new Promise(r => setTimeout(r, 150));
        }
    }

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        try {
            if (createdTabIds.length) {
                await page.evaluate((ids) => chrome.tabs.remove(ids).catch(() => {}), createdTabIds);
            }
        } catch (e) { }
        await teardownBrowser(browser);
    });

    test('stays inert by default — the switch is opt-in (FR-3.06)', async () => {
        const t1 = await createTab('https://example.com/ai-default-1');
        await waitJudged(t1.id);
        const t2 = await createTab('https://example.com/ai-default-2');
        await waitJudged(t2.id);
        await assertStaysUngrouped(t1.id);
        expect(await groupOf(t2.id)).toBeNull();
    }, 60000);

    test('two consecutive same-domain tabs create a domain-named group; later tabs join it (FR-3.04/3.05)', async () => {
        await page.evaluate(() => chrome.storage.sync.set({ aiAutoRoutingEnabled: true }));

        const t1 = await createTab('https://example.com/ai-pair-1');
        await waitJudged(t1.id);
        const t2 = await createTab('https://example.com/ai-pair-2');

        // Both tabs land in ONE group titled with the domain placeholder.
        let g1 = null;
        let g2 = null;
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
            g1 = await groupOf(t1.id);
            g2 = await groupOf(t2.id);
            if (g1 && g2) break;
            await new Promise(r => setTimeout(r, 100));
        }
        expect(g1).not.toBeNull();
        expect(g2).not.toBeNull();
        expect(g1.groupId).toBe(g2.groupId);
        expect(g1.title).toBe('example.com');

        // A different-domain detour must not break the JOIN path (FR-3.05b:
        // membership needs no consecutiveness once the group exists).
        const detour = await createTab('https://example.org/ai-detour');
        await waitJudged(detour.id);

        const t3 = await createTab('https://example.com/ai-pair-3');
        let g3 = null;
        const joinDeadline = Date.now() + 8000;
        while (Date.now() < joinDeadline) {
            g3 = await groupOf(t3.id);
            if (g3) break;
            await new Promise(r => setTimeout(r, 100));
        }
        expect(g3).not.toBeNull();
        expect(g3.groupId).toBe(g1.groupId);
    }, 90000);

    test('undo via the toast button dissolves the pair and starts a cooldown (FR-3.07)', async () => {
        // Fresh grouping on a second domain; the toast is clicked IMMEDIATELY
        // after the pair forms so the 10s auto-hide window is never approached
        // (review PR #217: keep UI-path assertions inside a tight window).
        const o1 = await createTab('https://example.org/ai-undo-1');
        await waitJudged(o1.id);
        const o2 = await createTab('https://example.org/ai-undo-2');
        let og = null;
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
            og = await groupOf(o1.id);
            if (og) break;
            await new Promise(r => setTimeout(r, 100));
        }
        expect(og).not.toBeNull();
        expect(og.title).toBe('example.org');

        await page.waitForSelector('#toast-container:not(.hidden)', { timeout: 5000 });
        await page.click('#toast-undo-btn');

        await page.waitForFunction(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs
                .filter(t => (t.url || '').startsWith('https://example.org/ai-undo'))
                .every(t => t.groupId === -1);
        }, { timeout: 8000 });

        // Cooldown recorded in the engine session state…
        const hasCooldown = await page.evaluate(async () => {
            const s = await chrome.storage.session.get('routingSessionState');
            const cd = s.routingSessionState && s.routingSessionState.cooldown;
            return !!cd && Object.keys(cd).some(k => k.endsWith(':example.org'));
        });
        expect(hasCooldown).toBe(true);

        // …and behaviorally: another consecutive pair does NOT regroup.
        const o4 = await createTab('https://example.org/ai-cooldown-1');
        await waitJudged(o4.id);
        const o5 = await createTab('https://example.org/ai-cooldown-2');
        await waitJudged(o5.id);
        await assertStaysUngrouped(o4.id);
        expect(await groupOf(o5.id)).toBeNull();
    }, 90000);

    test('undo dissolves members that JOINED after creation — no toast timing involved (FR-3.07)', async () => {
        // The example.com group from the earlier test is still alive and holds
        // three members (t1, t2 created + t3 joined). Send routing:aiUndo with
        // the CREATION-TIME tabIds snapshot on purpose: the engine must ignore
        // the snapshot and dissolve current membership by groupId query.
        const group = await page.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            const t = tabs.find(x => (x.url || '').startsWith('https://example.com/ai-pair'));
            if (!t || t.groupId === -1) return null;
            const members = await chrome.tabs.query({ groupId: t.groupId });
            return { groupId: t.groupId, windowId: t.windowId, memberIds: members.map(m => m.id) };
        });
        expect(group).not.toBeNull();
        expect(group.memberIds.length).toBe(3);

        const staleSnapshot = group.memberIds.slice(0, 2); // pretend the joiner is unknown
        const ack = await page.evaluate(
            (p) => chrome.runtime.sendMessage({ action: 'routing:aiUndo', windowId: p.windowId, domain: 'example.com', groupId: p.groupId, tabIds: p.tabIds }),
            { windowId: group.windowId, groupId: group.groupId, tabIds: staleSnapshot }
        );
        expect(ack).toEqual({ ok: true });

        // ALL three members leave the group, including the one missing from the snapshot.
        await page.waitForFunction(async (ids) => {
            const tabs = await chrome.tabs.query({});
            return ids.every(id => {
                const t = tabs.find(x => x.id === id);
                return !t || t.groupId === -1;
            });
        }, { timeout: 8000 }, group.memberIds);
    }, 60000);

    test('a previous tab that navigated away is never pulled into the group (stale lastNav re-check)', async () => {
        // Regression for review PR #217: judged-once means lastNav can point at
        // a tab whose CURRENT url is another domain — it must not be included.
        const x = await createTab('https://example.net/ai-stale-1');
        await waitJudged(x.id);
        // Same tab manually navigates away; judged-once → engine ignores this.
        await page.evaluate((id) => chrome.tabs.update(id, { url: 'https://example.org/ai-stale-detour' }), x.id);
        await page.waitForFunction(async (id) => {
            const t = await chrome.tabs.get(id);
            return (t.url || '').startsWith('https://example.org/');
        }, { timeout: 8000 }, x.id);

        const y = await createTab('https://example.net/ai-stale-2');
        await waitJudged(y.id);
        // Old behavior would have paired x+y under 'example.net' here.
        await assertStaysUngrouped(x.id);
        expect(await groupOf(y.id)).toBeNull();

        // y became the fresh lastNav: the NEXT example.net tab pairs with y.
        const z = await createTab('https://example.net/ai-stale-3');
        let zg = null;
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
            zg = await groupOf(z.id);
            if (zg) break;
            await new Promise(r => setTimeout(r, 100));
        }
        expect(zg).not.toBeNull();
        expect(zg.title).toBe('example.net');
        expect((await groupOf(y.id)).groupId).toBe(zg.groupId);
        expect(await groupOf(x.id)).toBeNull(); // the stale tab stays out
    }, 90000);
});
