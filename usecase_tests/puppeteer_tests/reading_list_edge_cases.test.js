const { setupBrowser, teardownBrowser } = require('./setup');

let browser;
let sidePanelUrl;

describe('Reading List Edge Cases', () => {
    // Fresh page per test pattern
    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        sidePanelUrl = setup.sidePanelUrl;
        await setup.page.close();
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('should filter reading list items by title and URL', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);

        try {
            // Wait for initial render to complete. Since default state is empty, we wait for empty message.
            await page.waitForSelector('.reading-list-empty');

            // Inject mock reading list items
            await page.evaluate(() => {
                const container = document.getElementById('reading-list');
                // Ensure container is visible and expanded
                container.classList.remove('collapsed');
                container.style.display = 'block';
                container.style.maxHeight = 'none';
                container.style.opacity = '1';

                container.innerHTML = ''; // Clear existing

                const createItem = (title, url) => {
                    const item = document.createElement('div');
                    item.className = 'reading-list-item';
                    item.dataset.title = title;
                    item.dataset.url = url;
                    item.setAttribute('role', 'button');
                    item.tabIndex = 0;

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

                    return item;
                };

                const section = document.getElementById('reading-list-section');
                if (section) section.style.display = 'block';

                const items = [
                    createItem('React Documentation', 'https://react.dev'),
                    createItem('Vue.js Guide', 'https://vuejs.org/guide'),
                    createItem('Popular Search Engine', 'https://google.com')
                ];

                items.forEach(item => container.appendChild(item));
            });

            // 1. Search for "React" (Title match)
            await page.type('#search-box', 'React');

            // Wait for search results to update (debounce is 300ms, wait for DOM update)
            await page.waitForFunction(
                () => document.querySelectorAll('.reading-list-item:not(.hidden)').length === 1
            );

            const reactItemTitle = await page.$eval('.reading-list-item:not(.hidden) .reading-list-title', el => el.textContent);
            expect(reactItemTitle).toContain('React');

            // 2. Search for "google" (URL/Domain match)
            // Use evaluate to clear input to ensure clean state
            await page.evaluate(() => {
                const input = document.getElementById('search-box');
                input.value = '';
                input.dispatchEvent(new Event('input')); // Trigger clear
            });

            // Wait for reset (all 3 items visible)
            await page.waitForFunction(
                () => document.querySelectorAll('.reading-list-item:not(.hidden)').length === 3
            );

            await page.type('#search-box', 'google');

            // Wait for filtering result
            await page.waitForFunction(
                () => document.querySelectorAll('.reading-list-item:not(.hidden)').length === 1
            );

            const googleItemUrl = await page.$eval('.reading-list-item:not(.hidden)', el => el.dataset.url);
            expect(googleItemUrl).toContain('google.com');

            // Verify domain highlight (implementation detail: .matched-domain)
            // Wait for it to appear just in case
            await page.waitForSelector('.matched-domain', { timeout: 2000 });
            const domainHighlight = await page.$eval('.reading-list-item:not(.hidden) .matched-domain', el => el.textContent);
            expect(domainHighlight).toBeTruthy();

        } finally {
            try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should support keyboard navigation in reading list', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);

        try {
            // Wait for initial render
            await page.waitForSelector('.reading-list-empty');

            // Inject items and clear others
            await page.evaluate(() => {
                // Clear other lists to simplify navigation path
                const tabList = document.getElementById('tab-list');
                if (tabList) tabList.innerHTML = '';

                const bookmarkList = document.getElementById('bookmark-list');
                if (bookmarkList) bookmarkList.innerHTML = '';

                const otherWindows = document.getElementById('other-windows-list');
                if (otherWindows) otherWindows.innerHTML = '';

                const container = document.getElementById('reading-list');
                // Ensure container is visible and expanded
                container.classList.remove('collapsed');
                container.style.display = 'block';
                container.style.maxHeight = 'none';
                container.style.opacity = '1';

                container.innerHTML = '';
                const section = document.getElementById('reading-list-section');
                if (section) section.style.display = 'block';

                const item1 = document.createElement('div');
                item1.className = 'reading-list-item';
                item1.id = 'rl-1';
                item1.tabIndex = 0; // Essential for focus
                item1.setAttribute('role', 'button');

                const item2 = document.createElement('div');
                item2.className = 'reading-list-item';
                item2.id = 'rl-2';
                item2.tabIndex = 0;
                item2.setAttribute('role', 'button');

                container.appendChild(item1);
                container.appendChild(item2);
            });

            // Focus search box
            await page.focus('#search-box');

            // Press Down to navigate to first item
            await page.keyboard.press('ArrowDown');

            // Wait for focus change
            await page.waitForFunction(
                () => document.activeElement.id === 'rl-1'
            );

            await page.keyboard.press('ArrowDown');
            await page.waitForFunction(
                () => document.activeElement.id === 'rl-2'
            );

            await page.keyboard.press('ArrowUp');
            await page.waitForFunction(
                () => document.activeElement.id === 'rl-1'
            );

        } finally {
             try { await page.close(); } catch (e) { }
        }
    }, 60000);

    test('should handle empty reading list state', async () => {
        const page = await browser.newPage();
        await page.goto(sidePanelUrl);

        try {
             // Wait for initial render
            await page.waitForSelector('.reading-list-empty');

             // Inject empty state via renderer logic (simulated)
            await page.evaluate(() => {
                const container = document.getElementById('reading-list');
                container.innerHTML = '';
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'reading-list-empty';
                emptyMsg.textContent = 'Right-click any link to add it here';
                container.appendChild(emptyMsg);
            });

            // Verify empty message presence
            const emptyText = await page.$eval('.reading-list-empty', el => el.textContent);
            expect(emptyText).toContain('Right-click');

            // Ensure search doesn't crash on empty list
             await page.type('#search-box', 'test');

             // Wait for search to process (no results icon should appear, or just ensure no crash)
             // We can wait for the 'no-search-results' element to be visible if it exists, or just wait a bit.
             // Since we don't have a specific "search done" event exposed to DOM other than visual changes.
             // We can check if search box value is set and nothing exploded.
             await page.waitForFunction(() => {
                 const searchBox = document.getElementById('search-box');
                 return searchBox && searchBox.value === 'test';
             });

             // Just a small stability wait since we don't have a clear target state change to wait for
             // other than "nothing happened to the list".
             // But actually, search results might show "No results found".
             await new Promise(r => setTimeout(r, 500));

             const containerChildCount = await page.$eval('#reading-list', el => el.children.length);
             // Search might hide the empty message or reading list entirely if count is 0
             // But we are mainly testing for crashes/errors here.
             expect(containerChildCount).toBeGreaterThanOrEqual(1); // Should still have empty msg or be empty

        } finally {
             try { await page.close(); } catch (e) { }
        }
    }, 60000);
});
