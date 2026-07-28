// BASE-024 P3 — snooze entry point (FR-4.01/4.02) + auto-archive settings (FR-5.01).
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Snooze entry + lifecycle settings', () => {
    let browser;
    let page;
    let extensionId;
    const tabUrl = 'https://example.com/snooze-me';

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        try {
            await page.evaluate(async (url) => {
                const tabs = await chrome.tabs.query({});
                for (const t of tabs) {
                    if ((t.url || '').startsWith(url)) await chrome.tabs.remove(t.id).catch(() => {});
                }
            }, tabUrl);
        } catch (e) { }
        await teardownBrowser(browser);
    });

    test('context menu → slot dialog → persists via SW, closes the tab, registers the wake alarm', async () => {
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

        const clicked = await page.evaluate(() => {
            const label = chrome.i18n.getMessage('ctxSnoozeTab');
            const item = Array.from(document.querySelectorAll('.custom-context-menu .context-menu-item'))
                .find(el => el.textContent.trim() === label.trim());
            if (!item) return false;
            item.click();
            return true;
        });
        expect(clicked).toBe(true);

        await page.waitForSelector('.snooze-form', { timeout: 5000 });
        const slotCount = await page.$$eval('.snooze-slot-btn', els => els.length);
        expect(slotCount).toBe(4);

        const before = Date.now();
        await page.click('.snooze-slot-btn[data-key="later1h"]');

        // The tab closes only after the SW ack (write-before-close).
        await page.waitForFunction(async (url) => {
            const tabs = await chrome.tabs.query({});
            return !tabs.some(t => (t.url || '').startsWith(url));
        }, { timeout: 8000 }, tabUrl);

        const snoozed = await page.evaluate(async () => {
            const v = await chrome.storage.local.get('snoozedTabs');
            return v.snoozedTabs ? v.snoozedTabs.items : [];
        });
        expect(snoozed).toHaveLength(1);
        expect(snoozed[0].url).toBe(tabUrl);
        const hourMs = 3600_000;
        expect(snoozed[0].wakeAt).toBeGreaterThanOrEqual(before + hourMs - 5000);
        expect(snoozed[0].wakeAt).toBeLessThanOrEqual(Date.now() + hourMs + 5000);

        // The engine registered the per-item wake alarm through the message.
        const alarm = await page.evaluate((id) => chrome.alarms.get(`lifecycleWake_${id}`), snoozed[0].id);
        expect(alarm).toBeTruthy();
        expect(Math.abs(alarm.scheduledTime - snoozed[0].wakeAt)).toBeLessThan(2000);

        // And the archive section pins it with the snoozed kind.
        await page.waitForFunction(() =>
            document.querySelector('.archive-item[data-kind="snoozed"]'), { timeout: 5000 });

        // Cleanup: cancel it via the SW op (also clears the alarm).
        await page.evaluate((id) => chrome.runtime.sendMessage({ action: 'lifecycle:cancelSnooze', id }), snoozed[0].id);
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('snoozedTabs');
            return v.snoozedTabs.items.length === 0;
        }, { timeout: 5000 });
    }, 90000);

    test('options exposes the auto-archive switch and threshold; both round-trip (FR-5.01)', async () => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForSelector('.opt-nav__item[data-section="features"]', { timeout: 15000 });
        await page.click('.opt-nav__item[data-section="features"]');
        await page.waitForSelector('#auto-archive-toggle', { timeout: 5000 });

        // Default off (FR-1.01).
        const initiallyChecked = await page.$eval('#auto-archive-toggle', el => el.checked);
        expect(initiallyChecked).toBe(false);

        await page.click('#auto-archive-toggle');
        await page.waitForFunction(async () => {
            const v = await chrome.storage.sync.get({ autoArchiveEnabled: false });
            return v.autoArchiveEnabled === true;
        }, { timeout: 5000 });

        await page.select('#auto-archive-threshold', '24');
        await page.waitForFunction(async () => {
            const v = await chrome.storage.sync.get({ autoArchiveIdleHours: 12 });
            return v.autoArchiveIdleHours === 24;
        }, { timeout: 5000 });

        // Reset for hermetic retries.
        await page.evaluate(() => chrome.storage.sync.set({ autoArchiveEnabled: false, autoArchiveIdleHours: 12 }));
    }, 60000);
});
