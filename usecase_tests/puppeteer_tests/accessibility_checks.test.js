const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Accessibility Checks', () => {
    let browser;
    let page;

    beforeAll(async () => {
        ({ browser, page } = await setupBrowser());
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('All images must have alt attributes', async () => {
        // Wait for tabs to render
        await page.waitForSelector('.tab-item');

        // Check tabs section
        const missingAltTabs = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('.tab-item img'));
            return imgs.filter(img => !img.hasAttribute('alt')).length;
        });
        expect(missingAltTabs).toBe(0);

        // Check other windows section (if any)
        const missingAltOtherWindows = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('#other-windows-list img'));
            return imgs.filter(img => !img.hasAttribute('alt')).length;
        });
        expect(missingAltOtherWindows).toBe(0);
    });

    test('All SVGs should have aria-hidden="true"', async () => {
        // Wait for render
        await page.waitForSelector('#settings-toggle');

        const missingAriaHidden = await page.evaluate(() => {
            const svgs = Array.from(document.querySelectorAll('svg'));
            // Filter out SVGs that might have a title or accessible name directly, but generally decorative ones should be hidden.
            return svgs.filter(svg => svg.getAttribute('aria-hidden') !== 'true').map(svg => svg.outerHTML.substring(0, 50));
        });

        expect(missingAriaHidden).toEqual([]);
    });

    test('Bookmarks should have alt attributes on favicons', async () => {
        // Create a bookmark first to ensure there's something to show
        await page.evaluate(async () => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Test Accessibility Bookmark',
                    url: 'https://example.com'
                }, resolve);
            });
        });

        // Reload page to sync UI with Chrome API
        await page.reload();
        await page.waitForSelector('#bookmark-list');

        // Expand bookmarks bar to render bookmarks
        try {
            await expandBookmarksBar(page);
        } catch (e) {
            console.warn('Expanding bookmarks bar failed or timed out:', e);
        }

        // Wait for ANY bookmark item to appear.
        // If expansion failed, this might fail, but let's see.
        try {
            await page.waitForSelector('.bookmark-item', { timeout: 5000 });
        } catch (e) {
            console.warn('No bookmark items found.');
        }

        const missingAltBookmarks = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('.bookmark-item img'));
            return imgs.filter(img => !img.hasAttribute('alt')).length;
        });

        expect(missingAltBookmarks).toBe(0);
    }, 30000);

    test('Tabs should have aria-label', async () => {
        await page.waitForSelector('.tab-item');
        const missingAriaLabel = await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('.tab-item'));
            return tabs.filter(t => !t.hasAttribute('aria-label') || t.getAttribute('aria-label') === '').length;
        });
        expect(missingAriaLabel).toBe(0);
    });
});
