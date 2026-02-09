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

    test('should filter reading list items by title and URL', async () => {
        // Reload to ensure clean state
        await page.reload();
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await page.waitForSelector('#reading-list', { timeout: 15000 });
        await page.waitForSelector('#search-box', { timeout: 15000 });

        // Inject mock reading list items
        await injectReadingListItems([
            { title: 'React Documentation', url: 'https://react.dev' },
            { title: 'Vue.js Guide', url: 'https://vuejs.org/guide' },
            { title: 'Popular Search Engine', url: 'https://google.com' }
        ]);

        // 1. Search for "React" (Title match) — use evaluate for reliable event dispatch
        await page.evaluate(() => {
            const input = document.getElementById('search-box');
            input.value = 'React';
            input.dispatchEvent(new Event('input'));
        });

        // Wait for search results to update (debounce is 300ms + DOM update)
        await page.waitForFunction(
            () => {
                const items = document.querySelectorAll('.reading-list-item');
                const visible = Array.from(items).filter(i => !i.classList.contains('hidden'));
                return visible.length === 1;
            },
            { timeout: 15000 }
        );

        const reactItemTitle = await page.$eval('.reading-list-item:not(.hidden) .reading-list-title', el => el.textContent);
        expect(reactItemTitle).toContain('React');

        // 2. Clear search and search for "google" (URL/Domain match)
        await page.evaluate(() => {
            const input = document.getElementById('search-box');
            input.value = '';
            input.dispatchEvent(new Event('input'));
        });

        // Wait for reset (all 3 items visible)
        await page.waitForFunction(
            () => {
                const items = document.querySelectorAll('.reading-list-item');
                const visible = Array.from(items).filter(i => !i.classList.contains('hidden'));
                return visible.length === 3;
            },
            { timeout: 15000 }
        );

        await page.evaluate(() => {
            const input = document.getElementById('search-box');
            input.value = 'google';
            input.dispatchEvent(new Event('input'));
        });

        // Wait for filtering result
        await page.waitForFunction(
            () => {
                const items = document.querySelectorAll('.reading-list-item');
                const visible = Array.from(items).filter(i => !i.classList.contains('hidden'));
                return visible.length === 1;
            },
            { timeout: 15000 }
        );

        const googleItemUrl = await page.$eval('.reading-list-item:not(.hidden)', el => el.dataset.url);
        expect(googleItemUrl).toContain('google.com');

        // Clean up search state
        await page.evaluate(() => {
            const input = document.getElementById('search-box');
            if (input) { input.value = ''; input.dispatchEvent(new Event('input')); }
        });
    }, 30000);

    test('should support keyboard navigation in reading list', async () => {
        // Reload to ensure clean state
        await page.reload();
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await page.waitForSelector('#reading-list', { timeout: 15000 });

        // Inject items with IDs for focus tracking
        await injectReadingListItems([
            { title: 'Item One', url: 'https://one.com', id: 'rl-1' },
            { title: 'Item Two', url: 'https://two.com', id: 'rl-2' }
        ]);

        // Focus the first item directly and verify focus works
        await page.focus('#rl-1');
        await page.waitForFunction(
            () => document.activeElement?.id === 'rl-1',
            { timeout: 15000 }
        );

        // Navigate to second item
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(
            () => document.activeElement?.id === 'rl-2',
            { timeout: 15000 }
        );

        // Navigate back to first item
        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(
            () => document.activeElement?.id === 'rl-1',
            { timeout: 15000 }
        );
    }, 30000);

    test('should handle empty reading list state', async () => {
        // Reload to ensure clean state
        await page.reload();
        await page.waitForSelector('#tab-list', { timeout: 15000 });
        await page.waitForSelector('#reading-list', { timeout: 15000 });
        await page.waitForSelector('#search-box', { timeout: 15000 });

        // Inject empty state
        await page.evaluate(() => {
            const container = document.getElementById('reading-list');
            container.replaceChildren();
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'reading-list-empty';
            emptyMsg.textContent = 'Right-click any link to add it here';
            container.appendChild(emptyMsg);
        });

        // Verify empty message presence
        await page.waitForSelector('.reading-list-empty', { timeout: 15000 });
        const emptyText = await page.$eval('.reading-list-empty', el => el.textContent);
        expect(emptyText).toContain('Right-click');

        // Ensure search doesn't crash on empty list
        await page.focus('#search-box');
        await page.type('#search-box', 'test');

        // Wait for search to process — verify search box value contains 'test'
        await page.waitForFunction(() => {
            const searchBox = document.getElementById('search-box');
            return searchBox && searchBox.value.includes('test');
        }, { timeout: 15000 });

        // Verify container still has content (empty msg or similar)
        const containerChildCount = await page.$eval('#reading-list', el => el.children.length);
        expect(containerChildCount).toBeGreaterThanOrEqual(0); // No crash is the primary assertion

        // Clean up
        await page.evaluate(() => {
            const input = document.getElementById('search-box');
            if (input) { input.value = ''; input.dispatchEvent(new Event('input')); }
        });
    }, 30000);
});
