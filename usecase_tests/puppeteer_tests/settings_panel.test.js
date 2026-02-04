const { setupBrowser, teardownBrowser } = require('./setup');

describe('Settings Panel Use Case', () => {
    let browser;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close();
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should open settings dialog when clicking settings button', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        // Wait for tab list to load to ensure app is initialized
        await page.waitForSelector('.tab-item', { timeout: 10000 }).catch(() => {
            return new Promise(r => setTimeout(r, 1000));
        });
        await page.waitForSelector('#settings-toggle');

        try {
            // Click settings button
            await page.click('#settings-toggle');

            // Wait for modal to appear
            await page.waitForSelector('.modal-overlay');

            // Verify modal is visible
            const modalVisible = await page.$('.modal-overlay');
            expect(modalVisible).not.toBeNull();

            // Verify theme section exists
            const themeDropdown = await page.$('#theme-select-dropdown');
            expect(themeDropdown).not.toBeNull();
        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should have collapsible sections in settings', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        // Wait for tab list to load to ensure app is initialized
        await page.waitForSelector('.tab-item', { timeout: 10000 }).catch(() => {
            return new Promise(r => setTimeout(r, 1000));
        });
        await page.waitForSelector('#settings-toggle');

        try {
            // Open settings
            await page.click('#settings-toggle');
            await page.waitForSelector('.modal-overlay');

            // Find collapsible toggles
            const collapsibleToggles = await page.$$('.collapsible-toggle');

            // Should have multiple sections (Theme, Background, Shortcuts, Side Panel Position, About)
            expect(collapsibleToggles.length).toBeGreaterThanOrEqual(3);
        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should expand/collapse sections when clicking headers', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        // Wait for tab list to load to ensure app is initialized
        await page.waitForSelector('.tab-item', { timeout: 10000 }).catch(() => {
            return new Promise(r => setTimeout(r, 1000));
        });
        await page.waitForSelector('#settings-toggle');

        try {
            // Open settings
            await page.click('#settings-toggle');
            await page.waitForSelector('.modal-overlay');

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
            await new Promise(r => setTimeout(r, 200));

            // Verify expanded
            const afterClickExpanded = await secondToggle.evaluate(el => {
                return el.getAttribute('aria-expanded') === 'true';
            });
            expect(afterClickExpanded).toBe(true);

            // Click to collapse again
            await secondToggle.click();
            await new Promise(r => setTimeout(r, 200));

            // Verify collapsed
            const finalExpanded = await secondToggle.evaluate(el => {
                return el.getAttribute('aria-expanded') === 'true';
            });
            expect(finalExpanded).toBe(false);
        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should show shortcuts section with current shortcut', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);
        // Wait for tab list to load to ensure app is initialized
        await page.waitForSelector('.tab-item', { timeout: 10000 }).catch(() => {
            return new Promise(r => setTimeout(r, 1000));
        });
        await page.waitForSelector('#settings-toggle');

        try {
            // Open settings
            await page.click('#settings-toggle');
            await page.waitForSelector('.modal-overlay');

            // Find and expand shortcuts section
            const collapsibleToggles = await page.$$('.collapsible-toggle');

            // Look for the shortcuts section by checking content
            for (const toggle of collapsibleToggles) {
                const text = await toggle.evaluate(el => el.textContent);
                if (text.includes('Shortcut') || text.includes('快捷')) {
                    await toggle.click();
                    await new Promise(r => setTimeout(r, 200));
                    break;
                }
            }

            // Check for shortcut display element
            const shortcutElement = await page.$('#current-shortcut');
            expect(shortcutElement).not.toBeNull();
        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);
}, 300000);
