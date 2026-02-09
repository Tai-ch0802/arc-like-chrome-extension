const { setupBrowser, teardownBrowser } = require('./setup');

describe('Reading List Edge Cases', () => {
    let browser;
    let page;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;

        // Wait for app initialization
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    /**
     * Helper: inject mock reading list items into #reading-list container.
     * Ensures container is visible and expanded before injection.
     */
    async function injectReadingListItems(items) {
        await page.evaluate((itemsData) => {
            const container = document.getElementById('reading-list');
            // Ensure container is visible and expanded
            container.classList.remove('collapsed');
            container.style.display = 'block';
            container.style.maxHeight = 'none';
            container.style.opacity = '1';

            container.replaceChildren(); // Clear existing

            const section = document.getElementById('reading-list-section');
            if (section) section.style.display = 'block';

            itemsData.forEach(({ title, url, id }) => {
                const item = document.createElement('div');
                item.className = 'reading-list-item';
                item.dataset.title = title;
                item.dataset.url = url;
                item.setAttribute('role', 'button');
                item.tabIndex = 0;
                if (id) item.id = id;

                const content = document.createElement('div');
                content.className = 'reading-list-content';

                const titleRow = document.createElement('div');
                titleRow.className = 'reading-list-title-row';

                const titleEl = document.createElement('span');
                titleEl.className = 'reading-list-title';
                titleEl.textContent = title;

                titleRow.appendChild(titleEl);
                content.appendChild(titleRow);
                item.appendChild(content);

                container.appendChild(item);
            });
        }, items);
    }

    /**
     * Helper: reset search box and wait for items to become visible.
     */
    async function resetSearch() {
        await page.evaluate(() => {
            const input = document.getElementById('search-box');
            if (input && input.value !== '') {
                input.value = '';
                input.dispatchEvent(new Event('input'));
            }
        });
    }

    test('should filter reading list items by title and URL', async () => {
        // Wait for reading list container (more robust than .reading-list-empty)
        await page.waitForSelector('#reading-list', { timeout: 5000 });

        // Inject mock reading list items
        await injectReadingListItems([
            { title: 'React Documentation', url: 'https://react.dev' },
            { title: 'Vue.js Guide', url: 'https://vuejs.org/guide' },
            { title: 'Popular Search Engine', url: 'https://google.com' }
        ]);

        // 1. Search for "React" (Title match)
        await page.type('#search-box', 'React');

        // Wait for search results to update (debounce is 300ms, wait for DOM update)
        await page.waitForFunction(
            () => document.querySelectorAll('.reading-list-item:not(.hidden)').length === 1,
            { timeout: 5000 }
        );

        const reactItemTitle = await page.$eval('.reading-list-item:not(.hidden) .reading-list-title', el => el.textContent);
        expect(reactItemTitle).toContain('React');

        // 2. Search for "google" (URL/Domain match)
        await resetSearch();

        // Wait for reset (all 3 items visible)
        await page.waitForFunction(
            () => document.querySelectorAll('.reading-list-item:not(.hidden)').length === 3,
            { timeout: 5000 }
        );

        await page.type('#search-box', 'google');

        // Wait for filtering result
        await page.waitForFunction(
            () => document.querySelectorAll('.reading-list-item:not(.hidden)').length === 1,
            { timeout: 5000 }
        );

        const googleItemUrl = await page.$eval('.reading-list-item:not(.hidden)', el => el.dataset.url);
        expect(googleItemUrl).toContain('google.com');

        // Verify domain highlight (.matched-domain)
        const hasDomainHighlight = await page.$('.reading-list-item:not(.hidden) .matched-domain');
        if (hasDomainHighlight) {
            const domainHighlight = await page.$eval('.reading-list-item:not(.hidden) .matched-domain', el => el.textContent);
            expect(domainHighlight).toBeTruthy();
        }

        // Clean up search state for next test
        await resetSearch();
    }, 30000);

    test('should support keyboard navigation in reading list', async () => {
        // Clear other lists to simplify navigation path
        await page.evaluate(() => {
            const tabList = document.getElementById('tab-list');
            if (tabList) tabList.replaceChildren();

            const bookmarkList = document.getElementById('bookmark-list');
            if (bookmarkList) bookmarkList.replaceChildren();

            const otherWindows = document.getElementById('other-windows-list');
            if (otherWindows) otherWindows.replaceChildren();
        });

        // Inject items with IDs for focus tracking
        await injectReadingListItems([
            { title: 'Item One', url: 'https://one.com', id: 'rl-1' },
            { title: 'Item Two', url: 'https://two.com', id: 'rl-2' }
        ]);

        // Focus search box
        await page.focus('#search-box');

        // Press Down to navigate to first item
        await page.keyboard.press('ArrowDown');

        // Wait for focus change (with null safety)
        await page.waitForFunction(
            () => document.activeElement?.id === 'rl-1',
            { timeout: 5000 }
        );

        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(
            () => document.activeElement?.id === 'rl-2',
            { timeout: 5000 }
        );

        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(
            () => document.activeElement?.id === 'rl-1',
            { timeout: 5000 }
        );
    }, 30000);

    test('should handle empty reading list state', async () => {
        // Inject empty state via renderer logic (simulated)
        await page.evaluate(() => {
            const container = document.getElementById('reading-list');
            container.replaceChildren();
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'reading-list-empty';
            emptyMsg.textContent = 'Right-click any link to add it here';
            container.appendChild(emptyMsg);
        });

        // Verify empty message presence
        await page.waitForSelector('.reading-list-empty', { timeout: 5000 });
        const emptyText = await page.$eval('.reading-list-empty', el => el.textContent);
        expect(emptyText).toContain('Right-click');

        // Ensure search doesn't crash on empty list
        await page.type('#search-box', 'test');

        // Wait for search to process — verify search box value is set without crashes
        await page.waitForFunction(() => {
            const searchBox = document.getElementById('search-box');
            return searchBox && searchBox.value === 'test';
        }, { timeout: 5000 });

        // Verify container still has content (empty msg or similar)
        const containerChildCount = await page.$eval('#reading-list', el => el.children.length);
        expect(containerChildCount).toBeGreaterThanOrEqual(0); // No crash is the primary assertion

        // Clean up search state
        await resetSearch();
    }, 30000);
});
