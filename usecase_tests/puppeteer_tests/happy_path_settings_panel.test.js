const { setupBrowser, teardownBrowser } = require('./setup');

describe('Settings Panel Use Case', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;

        // Wait for app initialization
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await page.waitForSelector('#settings-toggle', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should open settings dialog when clicking settings button', async () => {
        // Click settings button
        await page.evaluate(() => document.getElementById('settings-toggle').click());

        // Wait for modal to appear
        await page.waitForSelector('.modal-overlay', { timeout: 10000 });

        // Verify modal is visible
        const modalVisible = await page.$('.modal-overlay');
        expect(modalVisible).not.toBeNull();

        // Verify theme section exists
        const themeDropdown = await page.$('#theme-select-dropdown');
        expect(themeDropdown).not.toBeNull();

        // Close modal for the next test
        const closeBtn = await page.$('.modal-overlay #closeButton');
        if (closeBtn) await closeBtn.click();
        await page.waitForFunction(() => !document.querySelector('.modal-overlay'), { timeout: 15000 });
    }, 30000);

    test('should have collapsible sections in settings', async () => {
        // Open settings
        await page.click('#settings-toggle');
        await page.waitForSelector('.modal-overlay', { timeout: 10000 });

        // Find collapsible toggles
        const collapsibleToggles = await page.$$('.collapsible-toggle');

        // Should have multiple sections (Theme, Background, Reading List, Shortcuts, Side Panel Position, About)
        expect(collapsibleToggles.length).toBeGreaterThanOrEqual(3);

        // Close modal for the next test
        const closeBtn = await page.$('.modal-overlay #closeButton');
        if (closeBtn) await closeBtn.click();
        await page.waitForFunction(() => !document.querySelector('.modal-overlay'), { timeout: 15000 });
    }, 30000);

    test('should expand/collapse sections when clicking headers', async () => {
        // Open settings
        await page.click('#settings-toggle');
        await page.waitForSelector('.modal-overlay', { timeout: 10000 });

        // Get all collapsible toggles
        const collapsibleToggles = await page.$$('.collapsible-toggle');
        expect(collapsibleToggles.length).toBeGreaterThan(1);

        // Find a collapsed section (not the first one which is expanded by default)
        const secondToggle = collapsibleToggles[1];

        // Check initial state (should be collapsed)
        const initiallyExpanded = await secondToggle.evaluate(el => {
            return el.getAttribute('aria-expanded') === 'true';
        });
        expect(initiallyExpanded).toBe(false);

        // Click to expand
        await secondToggle.click();

        // Wait for aria-expanded to become 'true'
        await page.waitForFunction(
            toggle => toggle.getAttribute('aria-expanded') === 'true',
            { timeout: 3000 },
            secondToggle
        );

        // Verify expanded
        const afterClickExpanded = await secondToggle.evaluate(el => {
            return el.getAttribute('aria-expanded') === 'true';
        });
        expect(afterClickExpanded).toBe(true);

        // Click to collapse again
        await secondToggle.click();

        // Wait for aria-expanded to become 'false'
        await page.waitForFunction(
            toggle => toggle.getAttribute('aria-expanded') === 'false',
            { timeout: 3000 },
            secondToggle
        );

        // Verify collapsed
        const finalExpanded = await secondToggle.evaluate(el => {
            return el.getAttribute('aria-expanded') === 'true';
        });
        expect(finalExpanded).toBe(false);

        // Close modal for the next test
        const closeBtn = await page.$('.modal-overlay #closeButton');
        if (closeBtn) await closeBtn.click();
        await page.waitForFunction(() => !document.querySelector('.modal-overlay'), { timeout: 15000 });
    }, 30000);

    test('should show shortcuts section with current shortcut', async () => {
        // Open settings
        await page.click('#settings-toggle');
        await page.waitForSelector('.modal-overlay', { timeout: 10000 });

        // Find and expand shortcuts section
        const collapsibleToggles = await page.$$('.collapsible-toggle');

        // Look for the shortcuts section by checking content
        for (const toggle of collapsibleToggles) {
            const text = await toggle.evaluate(el => el.textContent);
            if (text.includes('Shortcut') || text.includes('快捷')) {
                await toggle.click();
                // Wait for aria-expanded to become 'true'
                await page.waitForFunction(
                    t => t.getAttribute('aria-expanded') === 'true',
                    { timeout: 3000 },
                    toggle
                );
                break;
            }
        }

        // Check for shortcut display element
        const shortcutElement = await page.$('#current-shortcut');
        expect(shortcutElement).not.toBeNull();

        // Close modal
        const closeBtn = await page.$('.modal-overlay #closeButton');
        if (closeBtn) await closeBtn.click();
        await page.waitForFunction(() => !document.querySelector('.modal-overlay'), { timeout: 15000 });
    }, 30000);
}, 180000);
