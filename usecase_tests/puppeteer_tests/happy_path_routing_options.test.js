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

    test('drag reorder after re-renders: order persists with exactly one write', async () => {
        // NOTE: this is a behavioral invariant test (drag works end-to-end and
        // writes storage exactly once), not a stacking-regression detector —
        // SortableJS's global active-drag singleton means stacked instances
        // would not double-fire onEnd anyway (verified by running this test
        // against a build without the destroy() fix; the fix prevents
        // instance/listener leaks, which E2E cannot observe).
        // Two rules to drag between.
        for (const [pattern, title] of [['a-site.com', 'GroupA'], ['b-site.com', 'GroupB']]) {
            await page.click('#routing-add-rule-btn');
            await page.waitForSelector('.routing-rule-form', { timeout: 5000 });
            await page.type('.routing-rule-form input:nth-of-type(1)', pattern);
            await page.type('.routing-rule-form input:nth-of-type(2)', title);
            await page.click('.routing-rule-form .confirm-btn');
            await page.waitForFunction((p) => {
                return !!Array.from(document.querySelectorAll('.routing-rule-row .routing-rule-text'))
                    .find(el => el.textContent.includes(p));
            }, { timeout: 5000 }, pattern);
        }

        // Provoke instance stacking: three edit-open/cancel cycles, each of
        // which re-runs renderList() on the SAME container (the regression the
        // destroy-before-recreate fix guards against).
        for (let i = 0; i < 3; i++) {
            await page.click('.routing-rule-row .routing-edit-btn');
            await page.waitForSelector('.routing-rule-form', { timeout: 5000 });
            await page.click('.routing-rule-form .cancel-btn');
            await page.waitForFunction(
                () => !document.querySelector('.routing-rule-form'), { timeout: 5000 });
        }

        // Count routingRules writes during ONE real drag.
        await page.evaluate(() => {
            window.__routingWrites = 0;
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.routingRules) window.__routingWrites++;
            });
        });

        const rows = await page.$$('.routing-rule-row .routing-drag-handle');
        expect(rows.length).toBe(2);
        const from = await rows[0].boundingBox();
        const to = await rows[1].boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        // Sortable needs intermediate movement to register the drag.
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 10, { steps: 12 });
        await page.mouse.up();

        // The reorder persisted with the swapped order…
        await page.waitForFunction(async () => {
            const v = await chrome.storage.local.get('routingRules');
            const sorted = [...v.routingRules.rules].sort((a, b) => a.order - b.order);
            return sorted[0].pattern === 'b-site.com';
        }, { timeout: 5000 });
        // …and exactly ONE write happened (stacked instances would each fire onEnd).
        const writes = await page.evaluate(() => window.__routingWrites);
        expect(writes).toBe(1);

        // Cleanup for hermetic retries.
        while (await page.$('.routing-rule-row .routing-delete-btn')) {
            await page.click('.routing-rule-row .routing-delete-btn');
            await new Promise(r => setTimeout(r, 150));
        }
        await page.waitForSelector('.routing-empty-state', { timeout: 5000 });
    }, 90000);

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
