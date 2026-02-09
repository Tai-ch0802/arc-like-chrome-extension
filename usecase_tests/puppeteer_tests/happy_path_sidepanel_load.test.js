const { setupBrowser, teardownBrowser } = require('./setup');

describe('Side Panel Load Use Case', () => {
    let browser;
    let page;
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should load the side panel successfully', async () => {
        // Verify the side panel URL is correct
        const url = page.url();
        expect(url).toContain('chrome-extension://');
        expect(url).toContain('sidepanel.html');
    });

    test('should render tab list container', async () => {
        // Wait for tab list container to be present
        await page.waitForSelector('#tab-list', { timeout: 5000 });
        const tabListExists = await page.$('#tab-list');
        expect(tabListExists).not.toBeNull();
    });

    test('should render bookmark list container', async () => {
        // Wait for bookmark list container to be present
        await page.waitForSelector('#bookmark-list', { timeout: 5000 });
        const bookmarkListExists = await page.$('#bookmark-list');
        expect(bookmarkListExists).not.toBeNull();
    });

    test('should render at least one tab item', async () => {
        // Wait for at least one tab item to render
        await page.waitForSelector('.tab-item', { timeout: 5000 });
        const tabItems = await page.$$('.tab-item');
        expect(tabItems.length).toBeGreaterThanOrEqual(1);
    });

    test('should have search input available', async () => {
        // Verify search box is present and interactable
        await page.waitForSelector('#search-box', { timeout: 5000 });
        const searchBox = await page.$('#search-box');
        expect(searchBox).not.toBeNull();

        // Verify it can receive input
        const isEnabled = await page.$eval('#search-box', el => !el.disabled);
        expect(isEnabled).toBe(true);
    });

    test('should have settings button available', async () => {
        // Verify settings panel toggle button exists
        await page.waitForSelector('#settings-toggle', { timeout: 5000 });
        const settingsBtn = await page.$('#settings-toggle');
        expect(settingsBtn).not.toBeNull();
    });
}, 120000);
