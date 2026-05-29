const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

describe('Bookmark Tagging Use Case', () => {
    let browser;
    let page;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        sidePanelUrl = setup.sidePanelUrl;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    /**
     * Seeds a tag into chrome.storage.local. tagManager.initTags() reads these
     * keys on sidepanel load, so callers must reload the page afterwards for the
     * in-memory tag cache to pick it up.
     */
    async function seedTag(tag) {
        await page.evaluate((t) => {
            return new Promise(resolve => {
                chrome.storage.local.get(['tags'], (res) => {
                    const tags = res.tags || {};
                    tags[t.id] = t;
                    chrome.storage.local.set({ tags }, resolve);
                });
            });
        }, tag);
    }

    /** Removes a tag definition and any bookmarkTags bindings. Best-effort cleanup. */
    async function cleanupTags() {
        try {
            await page.evaluate(() => {
                return new Promise(resolve => {
                    chrome.storage.local.remove(['tags', 'bookmarkTags'], resolve);
                });
            });
        } catch (e) { }
    }

    test('should assign a tag to a bookmark via the edit dialog', async () => {
        // 1. Seed a bookmark (same pattern as happy_path_edit_bookmark.test.js)
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Tagging Edit Bookmark',
                    url: 'https://example.com/tagging-edit'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        // 1b. Seed a tag (approach a: direct chrome.storage.local seed + reload)
        await seedTag({ id: 't_work', name: 'Work', color: 'blue', createdAt: Date.now() });

        try {
            // Reload so initTags() picks up the seeded tag
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);

            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.waitForSelector(bookmarkSelector, { timeout: 10000 });

            // 2. Open the edit dialog
            await page.hover(bookmarkSelector);
            await page.waitForSelector(`${bookmarkSelector} .bookmark-edit-btn`, { visible: true, timeout: 5000 });
            await page.click(`${bookmarkSelector} .bookmark-edit-btn`);

            // The form dialog renders the custom tag picker
            await page.waitForSelector('.tag-picker', { timeout: 5000 });
            await page.waitForSelector('.tag-picker__row input[type="checkbox"][value="t_work"]', { timeout: 5000 });

            // Check the tag's checkbox
            await page.click('.tag-picker__row input[type="checkbox"][value="t_work"]');

            // Confirm/save
            await page.click('.modal-buttons .confirm-btn');

            // 3. Assert the bookmark row now shows a tag dot with the tag color
            await page.waitForSelector(`${bookmarkSelector} .bookmark-tags .bookmark-tag-dot[data-color="blue"]`, { timeout: 10000 });

            const dotCount = await page.$$eval(
                `${bookmarkSelector} .bookmark-tag-dot`,
                dots => dots.length
            );
            expect(dotCount).toBe(1);

            // Verify the binding was persisted to storage
            const persisted = await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.storage.local.get(['bookmarkTags'], (res) => {
                        resolve((res.bookmarkTags || {})[id] || []);
                    });
                });
            }, testBookmarkId);
            expect(persisted).toContain('t_work');
        } finally {
            await cleanupTags();
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
        }
    }, 120000);

    test('should assign and unassign a tag via the right-click manage-tags popover', async () => {
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Tagging Context Bookmark',
                    url: 'https://example.com/tagging-context'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        await seedTag({ id: 't_read', name: 'Reading', color: 'green', createdAt: Date.now() });

        try {
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);

            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.waitForSelector(bookmarkSelector, { timeout: 10000 });

            // Right-click to open the custom context menu
            await page.click(bookmarkSelector, { button: 'right' });
            await page.waitForSelector('.custom-context-menu', { timeout: 5000 });

            // Click the "Manage tags" item (last item for a bookmark with a url)
            await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.custom-context-menu .context-menu-item'));
                // Manage tags is the last item; click it directly to avoid i18n coupling
                items[items.length - 1].click();
            });

            // Menu content is replaced by the popover tag picker
            await page.waitForSelector('.custom-context-menu .tag-picker--popover', { timeout: 5000 });
            await page.waitForSelector('.tag-picker__row input[type="checkbox"][value="t_read"]', { timeout: 5000 });

            // Check the box -> immediate assign + row update.
            // We toggle `checked` and dispatch `change` directly rather than a real
            // mouse click: a real click bubbles to the document-level listener that
            // closes the whole context menu, racing the assign handler. Dispatching
            // `change` exercises the exact popover handler the UI relies on
            // (tagselectionchange -> tagManager.addTagToBookmark) deterministically.
            await page.evaluate(() => {
                const cb = document.querySelector('.tag-picker__row input[type="checkbox"][value="t_read"]');
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: false }));
            });
            await page.waitForSelector(`${bookmarkSelector} .bookmark-tag-dot[data-color="green"]`, { timeout: 10000 });

            // Uncheck the box -> immediate removal (popover survives the row re-render)
            await page.waitForSelector('.tag-picker__row input[type="checkbox"][value="t_read"]', { timeout: 5000 });
            await page.evaluate(() => {
                const cb = document.querySelector('.tag-picker__row input[type="checkbox"][value="t_read"]');
                cb.checked = false;
                cb.dispatchEvent(new Event('change', { bubbles: false }));
            });
            await page.waitForFunction(
                sel => !document.querySelector(sel),
                { timeout: 10000 },
                `${bookmarkSelector} .bookmark-tag-dot`
            );

            const persisted = await page.evaluate((id) => {
                return new Promise(resolve => {
                    chrome.storage.local.get(['bookmarkTags'], (res) => {
                        resolve((res.bookmarkTags || {})[id] || []);
                    });
                });
            }, testBookmarkId);
            expect(persisted).not.toContain('t_read');
        } finally {
            await cleanupTags();
            try {
                await page.evaluate((id) => {
                    return new Promise(resolve => {
                        chrome.bookmarks.remove(id, resolve);
                    });
                }, testBookmarkId);
            } catch (e) { }
        }
    }, 120000);
});
