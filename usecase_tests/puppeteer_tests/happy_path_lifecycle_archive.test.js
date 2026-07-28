// BASE-024 P1 — lifecycle engine E2E (FR-1.x auto-archive, FR-4.03/4.04 wake).
//
// Test seams (SA §8.1, no test-only backdoors):
//   - the engine reads autoArchiveIdleHours permissively → a tiny fraction
//     makes just-created background tabs idle within a second;
//   - unpacked extensions are exempt from the alarms minimum-delay clamp →
//     creating the engine's own alarm with a near-now `when` fires the REAL
//     handler through background.js's dispatcher.
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Tab lifecycle engine', () => {
    let browser;
    let page;
    const createdTabIds = [];

    async function createTab(url, extra = {}) {
        const tab = await page.evaluate(
            (u, x) => chrome.tabs.create({ url: u, active: false, ...x }),
            url, extra
        );
        createdTabIds.push(tab.id);
        return tab;
    }

    function fireHeartbeat() {
        return page.evaluate(() =>
            chrome.alarms.create('lifecycleHeartbeat', { when: Date.now() + 300 }));
    }

    async function tabExists(tabId) {
        return page.evaluate((id) => chrome.tabs.get(id).then(() => true, () => false), tabId);
    }

    async function archivedUrls() {
        return page.evaluate(async () => {
            const v = await chrome.storage.local.get('archivedTabs');
            return (v.archivedTabs ? v.archivedTabs.items : []).map(i => i.url);
        });
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

    test('stays inert while the switch is off — opt-in (FR-1.01)', async () => {
        await page.evaluate(() => chrome.storage.sync.set({ autoArchiveIdleHours: 0.0001 }));
        const t = await createTab('https://example.com/lifecycle-off');
        await new Promise(r => setTimeout(r, 800)); // idle beyond the tiny threshold
        await fireHeartbeat();
        await new Promise(r => setTimeout(r, 1500));
        expect(await tabExists(t.id)).toBe(true);
        expect(await archivedUrls()).toEqual([]);
    }, 60000);

    test('archives idle tabs (persisted BEFORE close) and honors the exemption chain', async () => {
        await page.evaluate(() => chrome.storage.sync.set({ autoArchiveEnabled: true }));

        const idle1 = await createTab('https://example.com/lifecycle-idle-1');
        const idle2 = await createTab('https://example.com/lifecycle-idle-2');
        const pinned = await createTab('https://example.com/lifecycle-pinned', { pinned: true });
        const grouped = await createTab('https://example.com/lifecycle-grouped');
        await page.evaluate((id) => chrome.tabs.group({ tabIds: [id] }), grouped.id);

        await new Promise(r => setTimeout(r, 800)); // everyone idles past the threshold
        await fireHeartbeat();

        // Idle unexempted tabs get closed and their URLs land in the archive.
        // Exact-equality membership on purpose: Array.includes on full URLs is
        // already exact, but CodeQL's URL-substring heuristic can't see the
        // array type — .some(===) says the same thing unambiguously.
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('archivedTabs');
            const urls = (v.archivedTabs ? v.archivedTabs.items : []).map(i => i.url);
            const has = (u) => urls.some(x => x === u);
            return has('https://example.com/lifecycle-idle-1')
                && has('https://example.com/lifecycle-idle-2');
        }, { timeout: 10000 });
        await page.waitForFunction(async (ids) => {
            const alive = await Promise.all(ids.map(id => chrome.tabs.get(id).then(() => true, () => false)));
            return alive.every(a => a === false);
        }, { timeout: 10000 }, [idle1.id, idle2.id]);

        // Exempted tabs survive the same scan.
        expect(await tabExists(pinned.id)).toBe(true);
        expect(await tabExists(grouped.id)).toBe(true);
        // The sidepanel page itself is its window's active tab — still here by definition of running.

        const items = await page.evaluate(async () => {
            const v = await chrome.storage.local.get('archivedTabs');
            return v.archivedTabs.items;
        });
        for (const it of items) {
            expect(it.id).toBeTruthy();
            expect(it.source).toBe('auto');
            expect(it.archivedAt).toBeGreaterThan(0);
        }
    }, 90000);

    test('never empties a window (FR-1.03f)', async () => {
        const win = await page.evaluate(() =>
            chrome.windows.create({ url: 'https://example.com/lifecycle-solo', focused: false }));
        const soloTabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
        expect(soloTabId).not.toBeNull();
        try {
            // Make it non-active? A solo tab is always its window's active tab —
            // both the active and last-tab exemptions protect it; the assertion
            // holds regardless of which one fires.
            await new Promise(r => setTimeout(r, 800));
            await fireHeartbeat();
            await new Promise(r => setTimeout(r, 1500));
            expect(await tabExists(soloTabId)).toBe(true);
        } finally {
            await page.evaluate((id) => chrome.windows.remove(id).catch(() => {}), win.id);
        }
    }, 60000);

    test('sweeps an expired snooze: reopens the tab and clears the record (FR-4.03/4.04)', async () => {
        await page.evaluate(() => chrome.storage.local.set({
            snoozedTabs: {
                schemaVersion: 1,
                items: [{
                    id: 'wake-test-1',
                    url: 'https://example.com/lifecycle-wake-me',
                    title: 'Wake me',
                    favIconUrl: '',
                    snoozedAt: Date.now() - 60_000,
                    wakeAt: Date.now() - 1_000, // already due (browser-was-closed case)
                }],
            },
        }));
        await fireHeartbeat();

        // The URL reopens as a background tab…
        let wokenTabId = null;
        await page.waitForFunction(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.some(t => (t.url || t.pendingUrl || '').startsWith('https://example.com/lifecycle-wake-me'));
        }, { timeout: 10000 });
        wokenTabId = await page.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            const t = tabs.find(x => (x.url || x.pendingUrl || '').startsWith('https://example.com/lifecycle-wake-me'));
            return t ? t.id : null;
        });
        expect(wokenTabId).not.toBeNull();
        createdTabIds.push(wokenTabId);

        // …and the snooze record is gone (open-first, remove-after order done).
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('snoozedTabs');
            return v.snoozedTabs && v.snoozedTabs.items.length === 0;
        }, { timeout: 5000 });
    }, 60000);
});
