// BASE-022 P1 — claim exemption regression (FR-2.07).
//
// Background: the reading-list flow creates its tab FIRST and joins it to the
// "From Reading List" group asynchronously afterwards, so a routing rule for
// the same domain races that grouping. The claim protocol (routing:claim,
// awaited BEFORE tabs.create) removes the race by construction.
//
// Test 1 verifies the claim mechanics deterministically: a claimed URL must
// not be routed (fails on any build without the claim handler), and the claim
// is single-use. Test 2 exercises the real reading-list flow end to end and
// samples for the rule group throughout — the transient misroute is timing-
// dependent, so the sampling is a best-effort tripwire on top of Test 1.
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Tab Routing Rules — claim exemption (reading list race)', () => {
    let browser;
    let page;
    let expectedRlTitle;
    const createdTabIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        // The reading-list group title is localized (the test browser follows
        // the HOST locale, e.g. zh-TW → 「來自 閱讀清單」) — resolve it the same
        // way the flow does instead of hardcoding the English string.
        expectedRlTitle = await page.evaluate(() => chrome.i18n.getMessage('readingListGroupName'));
        expect(expectedRlTitle).toBeTruthy();
        await page.evaluate((now) => chrome.storage.local.set({
            routingRules: {
                schemaVersion: 1,
                updatedAt: now,
                rules: [{
                    id: 'claim-test-rule',
                    enabled: true,
                    matchType: 'domain',
                    pattern: 'example.com',
                    groupTitle: 'News',
                    groupColor: 'blue',
                    order: 0,
                    createdAt: now,
                    updatedAt: now,
                }],
                tombstones: {},
            },
        }), Date.now());
    }, 120000);

    afterAll(async () => {
        try {
            if (createdTabIds.length) {
                await page.evaluate((ids) => chrome.tabs.remove(ids).catch(() => {}), createdTabIds);
            }
        } catch (e) { }
        await teardownBrowser(browser);
    });

    async function groupTitleOf(tabId) {
        return page.evaluate(async (id) => {
            try {
                const t = await chrome.tabs.get(id);
                if (t.groupId === -1) return null;
                const g = await chrome.tabGroups.get(t.groupId);
                return g.title;
            } catch (e) {
                return null;
            }
        }, tabId);
    }

    test('a claimed URL is exempt from routing exactly once (FR-2.07 mechanics)', async () => {
        const url = 'https://example.com/claimed-mechanics';

        // Claim, then create — same ordering the reading-list flow uses.
        const ack = await page.evaluate(
            (u) => chrome.runtime.sendMessage({ action: 'routing:claim', urls: [u] }),
            url
        );
        expect(ack).toEqual({ ok: true });

        const claimed = await page.evaluate((u) => chrome.tabs.create({ url: u, active: false }), url);
        createdTabIds.push(claimed.id);

        // The claimed tab must stay ungrouped for the whole observation window.
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
            expect(await groupTitleOf(claimed.id)).toBeNull();
            await new Promise(r => setTimeout(r, 150));
        }

        // The claim was consumed: the SAME URL in a fresh tab routes normally.
        const unclaimed = await page.evaluate((u) => chrome.tabs.create({ url: u, active: false }), url);
        createdTabIds.push(unclaimed.id);
        let title = null;
        const routeDeadline = Date.now() + 8000;
        while (Date.now() < routeDeadline && title === null) {
            title = await groupTitleOf(unclaimed.id);
            if (title === null) await new Promise(r => setTimeout(r, 100));
        }
        expect(title).toBe('News');

        // In-test cleanup: closing both tabs dissolves the 'News' group so the
        // next test's "no News group exists" assertion starts from a clean world.
        await page.evaluate(
            (ids) => chrome.tabs.remove(ids).catch(() => {}),
            [claimed.id, unclaimed.id]
        );
        createdTabIds.length = 0;
    }, 60000);

    test('opening a reading-list item lands in "From Reading List", never in the rule group', async () => {
        for (let round = 0; round < 2; round++) {
            // Unique per attempt: jest.retryTimes re-runs the whole test and
            // chrome.readingList rejects duplicate URLs across attempts.
            const url = `https://example.com/claimed-flow-${round}-${Date.now()}`;
            // The flow opens its tab with active:true, which steals focus from
            // the sidepanel page — refocus it or page.click hangs forever.
            await page.bringToFront();
            await page.evaluate(
                (u, r) => chrome.readingList.addEntry({ url: u, title: `Claim Flow ${r}`, hasBeenRead: false }),
                url, round
            );
            const itemSelector = `.reading-list-item[data-url="${url}"]`;
            await page.waitForSelector(itemSelector, { timeout: 10000 });
            await page.click(itemSelector);

            // Find the opened tab, then watch it settle: 'News' must never appear.
            let openedTabId = null;
            let finalTitle = null;
            const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
                const snapshot = await page.evaluate(async (u) => {
                    const tabs = await chrome.tabs.query({});
                    const tab = tabs.find(t => (t.url || t.pendingUrl || '').startsWith(u));
                    if (!tab) return null;
                    let title = null;
                    if (tab.groupId !== -1) {
                        try { title = (await chrome.tabGroups.get(tab.groupId)).title; } catch (e) { }
                    }
                    return { tabId: tab.id, groupTitle: title };
                }, url);
                if (snapshot) {
                    openedTabId = snapshot.tabId;
                    expect(snapshot.groupTitle).not.toBe('News'); // tripwire at every sample
                    if (snapshot.groupTitle === expectedRlTitle) {
                        finalTitle = snapshot.groupTitle;
                        break;
                    }
                }
                await new Promise(r => setTimeout(r, 60));
            }
            expect(openedTabId).not.toBeNull();
            expect(finalTitle).toBe(expectedRlTitle);

            // Post-settle: the rule group must not exist anywhere in the window.
            const newsExists = await page.evaluate(async () => {
                const groups = await chrome.tabGroups.query({});
                return groups.some(g => g.title === 'News');
            });
            expect(newsExists).toBe(false);

            // Per-round cleanup: restores focus for the next round and keeps
            // retries hermetic.
            await page.evaluate(async (id, u) => {
                try { await chrome.tabs.remove(id); } catch (e) { }
                try { await chrome.readingList.removeEntry({ url: u }); } catch (e) { }
            }, openedTabId, url);
        }
    }, 90000);
});
