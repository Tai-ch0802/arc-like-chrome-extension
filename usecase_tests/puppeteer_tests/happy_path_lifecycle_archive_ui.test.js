// BASE-024 P2 — archive section UI (FR-2.02/2.03, FR-3.01~3.05).
// Store state is seeded directly; every WRITE the UI performs must round-trip
// through the SW single-writer messages (SA v1.2), which these flows exercise
// end to end.
const { setupBrowser, teardownBrowser } = require('./setup');

const seedArchived = (items) => ({ archivedTabs: { schemaVersion: 1, items } });

describe('Archive section UI', () => {
    let browser;
    let page;

    const archivedItem = (id, over = {}) => ({
        id,
        url: `https://example.com/archived-${id}`,
        title: `Archived ${id}`,
        favIconUrl: '',
        archivedAt: Date.now() - 3 * 3600_000,
        source: 'auto',
        ...over,
    });

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('section hidden when empty & switch off; appears with items, badge and relative time (D1/FR-3.01/3.03)', async () => {
        // Default world: nothing archived, switch off → whole section hidden.
        await page.waitForFunction(() =>
            document.getElementById('archive-section').classList.contains('hidden'), { timeout: 5000 });

        await page.evaluate((seed) => chrome.storage.local.set(seed),
            seedArchived([archivedItem('a1'), archivedItem('a2')]));

        await page.waitForFunction(() =>
            !document.getElementById('archive-section').classList.contains('hidden'), { timeout: 5000 });
        await page.waitForFunction(() =>
            document.querySelectorAll('.archive-item').length === 2, { timeout: 5000 });

        const badge = await page.$eval('#archive-count-badge', el => ({ text: el.textContent, hidden: el.classList.contains('hidden') }));
        expect(badge.hidden).toBe(false);
        expect(badge.text).toBe('2');

        // Relative time renders via timeUtils (host-locale-proof: assert the
        // i18n message resolved, whatever the language).
        const meta = await page.evaluate(() => {
            const label = chrome.i18n.getMessage('timeHoursAgo', ['3']);
            const first = document.querySelector('.archive-item .archive-item-meta');
            return { label, text: first ? first.textContent : null };
        });
        expect(meta.text).toBe(meta.label);
    }, 60000);

    test('clicking an item restores it: tab opens and the entry is removed via SW (FR-2.02)', async () => {
        await page.click('.archive-item[data-item-id="a1"]');

        await page.waitForFunction(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.some(t => (t.url || t.pendingUrl || '').startsWith('https://example.com/archived-a1'));
        }, { timeout: 8000 });
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('archivedTabs');
            return v.archivedTabs.items.every(i => i.id !== 'a1');
        }, { timeout: 5000 });

        // Cleanup the opened tab.
        await page.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            const t = tabs.find(x => (x.url || x.pendingUrl || '').startsWith('https://example.com/archived-a1'));
            if (t) await chrome.tabs.remove(t.id);
        });
    }, 60000);

    test('per-item delete and clear-all with confirm (FR-2.03)', async () => {
        // Delete the remaining a2 via its hover button.
        await page.evaluate(() => {
            document.querySelector('.archive-item[data-item-id="a2"] button[data-action="delete"]').click();
        });
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('archivedTabs');
            return v.archivedTabs.items.length === 0;
        }, { timeout: 5000 });

        // Seed several and clear all through the confirm dialog.
        await page.evaluate((seed) => chrome.storage.local.set(seed),
            seedArchived([archivedItem('b1'), archivedItem('b2'), archivedItem('b3')]));
        await page.waitForFunction(() =>
            document.querySelectorAll('.archive-item').length === 3, { timeout: 5000 });

        await page.click('#archive-clear-btn');
        await page.waitForSelector('.modal-overlay .confirm-btn', { timeout: 5000 });
        await page.click('.modal-overlay .confirm-btn');
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('archivedTabs');
            return v.archivedTabs.items.length === 0;
        }, { timeout: 5000 });
        // Empty again + switch still off → section hides once more (D1).
        await page.waitForFunction(() =>
            document.getElementById('archive-section').classList.contains('hidden'), { timeout: 5000 });
    }, 60000);

    test('snoozed items pin on top with a wake badge; delete = cancel keeps it archived (FR-3.04)', async () => {
        const wakeAt = Date.now() + 3600_000;
        await page.evaluate((seedA, wake) => chrome.storage.local.set({
            ...seedA,
            snoozedTabs: {
                schemaVersion: 1,
                items: [{ id: 's1', url: 'https://example.com/snoozed-s1', title: 'Snoozed s1', favIconUrl: '', snoozedAt: Date.now(), wakeAt: wake }],
            },
        }), seedArchived([archivedItem('c1')]), wakeAt);

        await page.waitForFunction(() =>
            document.querySelectorAll('.archive-item').length === 2, { timeout: 5000 });
        const kinds = await page.$$eval('.archive-item', els => els.map(el => el.dataset.kind));
        expect(kinds).toEqual(['snoozed', 'archived']); // snoozed on top

        // Cancel: the snoozed row's button converts it into an archived entry.
        await page.evaluate(() => {
            document.querySelector('.archive-item[data-kind="snoozed"] button[data-action="cancel-snooze"]').click();
        });
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get(['archivedTabs', 'snoozedTabs']);
            return v.snoozedTabs.items.length === 0
                && v.archivedTabs.items.some(i => i.url === 'https://example.com/snoozed-s1' && i.source === 'snooze-cancel');
        }, { timeout: 5000 });
    }, 60000);

    test('archive toast offers whole-round undo (FR-3.05)', async () => {
        // Simulate the engine broadcast for a completed round.
        await page.evaluate(() => chrome.storage.local.set({
            archivedTabs: {
                schemaVersion: 1,
                items: [
                    { id: 'u1', url: 'https://example.com/undo-1', title: 'U1', favIconUrl: '', archivedAt: Date.now(), source: 'auto' },
                    { id: 'u2', url: 'https://example.com/undo-2', title: 'U2', favIconUrl: '', archivedAt: Date.now(), source: 'auto' },
                ],
            },
        }));
        // runtime.sendMessage never delivers to the SENDER's own context — the
        // sidepanel would not hear its own broadcast. Send from a second
        // extension page instead (mirrors the SW being the real sender).
        const senderPage = await browser.newPage();
        const extensionId = page.url().split('/')[2];
        await senderPage.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
        await senderPage.evaluate(() => chrome.runtime.sendMessage({
            type: 'lifecycle:archived',
            items: [
                { id: 'u1', url: 'https://example.com/undo-1', title: 'U1' },
                { id: 'u2', url: 'https://example.com/undo-2', title: 'U2' },
            ],
        }).catch(() => {}));
        await senderPage.close();
        await page.bringToFront();

        await page.waitForSelector('#toast-container:not(.hidden)', { timeout: 5000 });
        await page.click('#toast-undo-btn');

        // Both tabs reopen and both entries leave the archive.
        await page.waitForFunction(async () => {
            const tabs = await chrome.tabs.query({});
            const urls = tabs.map(t => t.url || t.pendingUrl || '');
            const has = (u) => urls.some(x => x.startsWith(u));
            if (!has('https://example.com/undo-1') || !has('https://example.com/undo-2')) return false;
            const v = await chrome.storage.local.get('archivedTabs');
            return v.archivedTabs.items.length === 0;
        }, { timeout: 8000 });

        // Cleanup reopened tabs.
        await page.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            for (const t of tabs) {
                if ((t.url || t.pendingUrl || '').startsWith('https://example.com/undo-')) {
                    await chrome.tabs.remove(t.id).catch(() => {});
                }
            }
        });
    }, 60000);
});
