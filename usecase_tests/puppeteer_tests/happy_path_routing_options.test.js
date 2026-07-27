// BASE-022 P2 — options "Auto Grouping Rules" section (FR-4.01~4.03, FR-2.06 UI).
// Follows the happy_path_drive_sync_section pattern: drive the real options
// page, assert storage round-trips through modules/routing/rulesStore.js.
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Routing options section', () => {
    let browser;
    let page;
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForSelector('.opt-nav__item[data-section="routing"]', { timeout: 15000 });
        await page.click('.opt-nav__item[data-section="routing"]');
        await page.waitForSelector('.opt-section[data-section="routing"].active', { timeout: 5000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('renders the global toggle and empty state; toggle persists to storage.sync', async () => {
        await page.waitForSelector('#routing-enabled-toggle', { timeout: 5000 });
        await page.waitForSelector('.routing-empty-state', { timeout: 5000 });

        await page.click('#routing-enabled-toggle'); // default on → off
        await page.waitForFunction(async () => {
            const v = await chrome.storage.sync.get({ routingEnabled: true });
            return v.routingEnabled === false;
        }, { timeout: 5000 });

        await page.click('#routing-enabled-toggle'); // back on
        await page.waitForFunction(async () => {
            const v = await chrome.storage.sync.get({ routingEnabled: true });
            return v.routingEnabled === true;
        }, { timeout: 5000 });
    }, 60000);

    test('adds, disables and deletes a rule through the inline form', async () => {
        // --- Add ---
        await page.click('#routing-add-rule-btn');
        await page.waitForSelector('.routing-rule-form', { timeout: 5000 });
        await page.type('.routing-rule-form input:nth-of-type(1)', 'example.com');
        await page.type('.routing-rule-form input:nth-of-type(2)', 'Routed');
        await page.select('.routing-rule-form select:nth-of-type(2)', 'red');
        await page.click('.routing-rule-form .confirm-btn');

        await page.waitForSelector('.routing-rule-row', { timeout: 5000 });
        const stored = await page.evaluate(async () => {
            const v = await chrome.storage.local.get('routingRules');
            return v.routingRules;
        });
        expect(stored.rules).toHaveLength(1);
        expect(stored.rules[0]).toMatchObject({
            matchType: 'domain',
            pattern: 'example.com',
            groupTitle: 'Routed',
            groupColor: 'red',
            enabled: true,
        });

        // --- Disable via the row checkbox ---
        await page.click('.routing-rule-row input[type="checkbox"]');
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('routingRules');
            return v.routingRules.rules[0].enabled === false;
        }, { timeout: 5000 });

        // --- Delete ---
        await page.click('.routing-rule-row .routing-delete-btn');
        await page.waitForSelector('.routing-empty-state', { timeout: 5000 });
        const after = await page.evaluate(async () => {
            const v = await chrome.storage.local.get('routingRules');
            return v.routingRules;
        });
        expect(after.rules).toHaveLength(0);
        expect(Object.keys(after.tombstones)).toHaveLength(1); // P4 merge safety
    }, 60000);

    test('edit form sanitizes input through the shared rulesStore path', async () => {
        await page.click('#routing-add-rule-btn');
        await page.waitForSelector('.routing-rule-form', { timeout: 5000 });
        await page.type('.routing-rule-form input:nth-of-type(1)', '  docs.google.com  ');
        await page.type('.routing-rule-form input:nth-of-type(2)', 'Docs');
        await page.click('.routing-rule-form .confirm-btn');
        await page.waitForSelector('.routing-rule-row', { timeout: 5000 });

        const pattern = await page.evaluate(async () => {
            const v = await chrome.storage.local.get('routingRules');
            return v.routingRules.rules[0].pattern;
        });
        expect(pattern).toBe('docs.google.com'); // trimmed by sanitizeRuleInput

        // Cleanup for a hermetic retry.
        await page.click('.routing-rule-row .routing-delete-btn');
        await page.waitForSelector('.routing-empty-state', { timeout: 5000 });
    }, 60000);
});
