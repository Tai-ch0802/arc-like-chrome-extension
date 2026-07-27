// BASE-022 P1 — routing engine E2E (FR-2.01/2.02/2.04/2.05/2.06).
// Rules are seeded straight into chrome.storage.local; the background engine
// picks them up via storage.onChanged. All assertions go through chrome.tabs /
// chrome.tabGroups so they hold with or without the sidepanel being rendered.
const { setupBrowser, teardownBrowser } = require('./setup');

const RULE_STATE = (rules) => ({
    routingRules: { schemaVersion: 1, updatedAt: Date.now(), rules, tombstones: {} },
});

const RULE = (over = {}) => ({
    id: `rule-${Math.random().toString(36).slice(2)}`,
    enabled: true,
    matchType: 'domain',
    pattern: 'example.com',
    groupTitle: 'Routed',
    groupColor: 'red',
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
});

describe('Tab Routing Rules — engine', () => {
    let browser;
    let page;
    const createdTabIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await page.evaluate((state) => chrome.storage.local.set(state), RULE_STATE([RULE()]));
    }, 120000);

    afterAll(async () => {
        try {
            if (createdTabIds.length) {
                await page.evaluate((ids) => chrome.tabs.remove(ids).catch(() => {}), createdTabIds);
            }
        } catch (e) { }
        await teardownBrowser(browser);
    });

    /** Create a tab and remember it for cleanup. */
    async function createTab(url) {
        const tab = await page.evaluate(
            (u) => chrome.tabs.create({ url: u, active: false }),
            url
        );
        createdTabIds.push(tab.id);
        return tab;
    }

    /** Poll until the tab belongs to a group; returns {title,color} or null on timeout. */
    async function waitForGroup(tabId, timeout = 8000) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const info = await page.evaluate(async (id) => {
                try {
                    const t = await chrome.tabs.get(id);
                    if (t.groupId === -1) return null;
                    const g = await chrome.tabGroups.get(t.groupId);
                    return { title: g.title, color: g.color, groupId: g.id };
                } catch (e) {
                    return null;
                }
            }, tabId);
            if (info) return info;
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    /** Bounded negative observation: the tab must stay ungrouped for the window. */
    async function assertStaysUngrouped(tabId, windowMs = 1500) {
        const deadline = Date.now() + windowMs;
        while (Date.now() < deadline) {
            const groupId = await page.evaluate(
                (id) => chrome.tabs.get(id).then(t => t.groupId).catch(() => -1),
                tabId
            );
            expect(groupId).toBe(-1);
            await new Promise(r => setTimeout(r, 150));
        }
    }

    test('routes a matching first navigation into a new titled+colored group (FR-2.01)', async () => {
        const tab = await createTab('https://example.com/routing-p1-a');
        const group = await waitForGroup(tab.id);
        expect(group).not.toBeNull();
        expect(group.title).toBe('Routed');
        expect(group.color).toBe('red');

        // Second matching tab joins the SAME group instead of creating a duplicate.
        const tab2 = await createTab('https://example.com/routing-p1-b');
        const group2 = await waitForGroup(tab2.id);
        expect(group2).not.toBeNull();
        expect(group2.groupId).toBe(group.groupId);
    }, 60000);

    test('never touches a tab that is already grouped (FR-2.02)', async () => {
        // Born blank (no URL → not startup-shaped), grouped BEFORE its first http commit.
        const tab = await page.evaluate(() => chrome.tabs.create({ active: false }));
        createdTabIds.push(tab.id);
        const keepGroupId = await page.evaluate(async (id) => {
            const gid = await chrome.tabs.group({ tabIds: [id] });
            await chrome.tabGroups.update(gid, { title: 'Keep' });
            return gid;
        }, tab.id);
        await page.evaluate(
            (id) => chrome.tabs.update(id, { url: 'https://example.com/grouped' }),
            tab.id
        );
        // Bounded observation: it must stay in 'Keep', never move to 'Routed'.
        const deadline = Date.now() + 1500;
        while (Date.now() < deadline) {
            const stillKeep = await page.evaluate(
                (id) => chrome.tabs.get(id).then(t => t.groupId).catch(() => null),
                tab.id
            );
            expect(stillKeep).toBe(keepGroupId);
            await new Promise(r => setTimeout(r, 150));
        }
    }, 60000);

    test('a manually ungrouped tab is never re-routed (FR-2.04)', async () => {
        const tab = await createTab('https://example.com/routing-p1-c');
        expect(await waitForGroup(tab.id)).not.toBeNull();

        await page.evaluate((id) => chrome.tabs.ungroup([id]), tab.id);
        await page.evaluate(
            (id) => chrome.tabs.update(id, { url: 'https://example.com/routing-p1-c-again' }),
            tab.id
        );
        await assertStaysUngrouped(tab.id);
    }, 60000);

    test('keeps routing with the sidepanel closed — engine lives in the SW (FR-2.05)', async () => {
        // Navigate the only extension page away from the sidepanel: from here on
        // no sidepanel context exists, only the service worker.
        const extensionId = page.url().split('/')[2];
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForSelector('#opt-nav', { timeout: 10000 });

        const tab = await createTab('https://example.com/routing-p1-d');
        const group = await waitForGroup(tab.id);
        expect(group).not.toBeNull();
        expect(group.title).toBe('Routed');
    }, 60000);

    test('does nothing while the global switch is off (FR-2.06)', async () => {
        await page.evaluate(() => chrome.storage.sync.set({ routingEnabled: false }));
        const tab = await createTab('https://example.com/routing-p1-e');
        await assertStaysUngrouped(tab.id);

        // Switch back on: the very next tab routes again (cache invalidation works).
        await page.evaluate(() => chrome.storage.sync.set({ routingEnabled: true }));
        const tab2 = await createTab('https://example.com/routing-p1-f');
        expect(await waitForGroup(tab2.id)).not.toBeNull();
    }, 60000);
});
