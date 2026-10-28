// ISSUE-257 WP1 — graceful degradation when the browser cannot create tab
// groups (Dia throws `Error: No window` from chrome.tabs.group).
//
// Real Chrome CAN group tabs, so we simulate the Dia condition the way the
// code itself records it: the per-device `tabGroupsUnsupported` flag in
// chrome.storage.local. With the flag set the side panel must hide every
// grouping affordance, and opening a reading-list item must still open the
// tab AND mark the entry read without creating the "From Reading List" group.
const { setupBrowser, teardownBrowser } = require('./setup');

const FLAG = { unsupported: true, brand: 'Chromium', majorVersion: 156, at: 1 };

describe('Dia capability degradation (tab groups unsupported)', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        // Record the flag exactly as apiManager's guard would, then reload so
        // every init path (stateManager cache, renderers) sees it from the start.
        await page.evaluate((flag) => chrome.storage.local.set({ tabGroupsUnsupported: flag }), FLAG);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        try {
            await page.evaluate(() => chrome.storage.local.remove('tabGroupsUnsupported'));
        } catch (e) { /* browser may be gone */ }
        await teardownBrowser(browser);
    });

    test('Smart Group button and per-row "add to group" buttons are hidden', async () => {
        const display = await page.$eval('#ai-group-btn', (el) => getComputedStyle(el).display);
        expect(display).toBe('none');
        // At least one tab row exists (the sidepanel page itself is excluded, but
        // the default about:blank/new tab is listed); none may carry the button.
        await page.waitForSelector('.tab-item', { timeout: 10000 });
        const groupButtons = await page.$$eval('.add-to-group-btn', (els) => els.length);
        expect(groupButtons).toBe(0);
    });

    test('opening a reading-list item still opens the tab and marks it read, without a group', async () => {
        const url = `https://example.com/dia-degrade-${Date.now()}`;
        await page.bringToFront();
        await page.evaluate(
            (u) => chrome.readingList.addEntry({ url: u, title: 'Dia Degrade', hasBeenRead: false }),
            url
        );
        const itemSelector = `.reading-list-item[data-url="${url}"]`;
        await page.waitForSelector(itemSelector, { timeout: 10000 });
        await page.click(itemSelector);

        let openedTabId = null;
        let hasBeenRead = false;
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
            const snapshot = await page.evaluate(async (u) => {
                const tabs = await chrome.tabs.query({});
                const tab = tabs.find(t => (t.url || t.pendingUrl || '').startsWith(u));
                const [entry] = await chrome.readingList.query({ url: u });
                return { tabId: tab ? tab.id : null, groupId: tab ? tab.groupId : null, read: Boolean(entry && entry.hasBeenRead) };
            }, url);
            if (snapshot.tabId !== null) {
                openedTabId = snapshot.tabId;
                expect(snapshot.groupId).toBe(-1); // never grouped while the flag is set
            }
            if (snapshot.tabId !== null && snapshot.read) { hasBeenRead = true; break; }
            await new Promise(r => setTimeout(r, 60));
        }
        expect(openedTabId).not.toBeNull();
        expect(hasBeenRead).toBe(true);

        const rlGroupExists = await page.evaluate(async () => {
            const groups = await chrome.tabGroups.query({});
            return groups.some(g => /reading list/i.test(g.title || ''));
        });
        expect(rlGroupExists).toBe(false);

        await page.evaluate(async (id, u) => {
            try { await chrome.tabs.remove(id); } catch (e) { }
            try { await chrome.readingList.removeEntry({ url: u }); } catch (e) { }
        }, openedTabId, url);
    }, 60000);
});
