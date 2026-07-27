// BASE-022 P2 — "Always group this site…" from the tab context menu
// (FR-3.01 entry, FR-3.03 immediate apply + toast undo).
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Routing rule via tab context menu', () => {
    let browser;
    let page;
    const tabUrl = 'https://example.com/ctx-rule';

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        try {
            await page.evaluate(async (url) => {
                const tabs = await chrome.tabs.query({});
                const t = tabs.find(x => (x.url || '').startsWith(url));
                if (t) await chrome.tabs.remove(t.id);
            }, tabUrl);
        } catch (e) { }
        await teardownBrowser(browser);
    });

    test('creates a rule, applies it to the tab immediately, and undo reverts both', async () => {
        await page.evaluate((url) => chrome.tabs.create({ url, active: false }), tabUrl);
        await page.waitForFunction((url) => {
            return !!Array.from(document.querySelectorAll('.tab-item')).find(
                el => el.dataset.url && el.dataset.url.startsWith(url)
            );
        }, { timeout: 10000 }, tabUrl);

        const targetTab = await page.evaluateHandle((url) => {
            return Array.from(document.querySelectorAll('.tab-item')).find(
                el => el.dataset.url && el.dataset.url.startsWith(url)
            );
        }, tabUrl);
        await targetTab.click({ button: 'right' });
        await page.waitForSelector('.custom-context-menu', { timeout: 15000 });

        // Click the routing item, located by its localized label (host-locale-proof).
        const clicked = await page.evaluate(() => {
            const label = chrome.i18n.getMessage('ctxAlwaysGroupSite');
            const item = Array.from(document.querySelectorAll('.custom-context-menu .context-menu-item'))
                .find(el => el.textContent.trim() === label.trim());
            if (!item) return false;
            item.click();
            return true;
        });
        expect(clicked).toBe(true);

        // Group picker: type a new group name and save.
        await page.waitForSelector('.group-picker-form', { timeout: 5000 });
        await page.type('.group-picker-new-input', 'CtxRouted');
        await page.click('.group-picker-form .confirm-btn');

        // Rule persisted with the tab's normalized domain.
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('routingRules');
            return v.routingRules && v.routingRules.rules.length === 1;
        }, { timeout: 5000 });
        const rule = await page.evaluate(async () => {
            const v = await chrome.storage.local.get('routingRules');
            return v.routingRules.rules[0];
        });
        expect(rule).toMatchObject({ matchType: 'domain', pattern: 'example.com', groupTitle: 'CtxRouted' });

        // FR-3.03: the originating tab was grouped immediately.
        const groupTitle = await page.evaluate(async (url) => {
            const tabs = await chrome.tabs.query({});
            const t = tabs.find(x => (x.url || '').startsWith(url));
            if (!t || t.groupId === -1) return null;
            return (await chrome.tabGroups.get(t.groupId)).title;
        }, tabUrl);
        expect(groupTitle).toBe('CtxRouted');

        // Undo: rule deleted AND the tab leaves the group.
        await page.waitForSelector('#toast-container:not(.hidden)', { timeout: 5000 });
        await page.click('#toast-undo-btn');
        await page.waitForFunction(async (url) => {
            const v = await chrome.storage.local.get('routingRules');
            if (v.routingRules.rules.length !== 0) return false;
            const tabs = await chrome.tabs.query({});
            const t = tabs.find(x => (x.url || '').startsWith(url));
            return t && t.groupId === -1;
        }, { timeout: 5000 }, tabUrl);
    }, 90000);
});
