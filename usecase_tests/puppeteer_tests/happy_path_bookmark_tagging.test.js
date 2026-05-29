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

            // Real click on the checkbox -> immediate assign + row update.
            // The document-level click listener now only closes the menu on
            // clicks OUTSIDE it (handleOutside), so an in-menu checkbox click no
            // longer closes the popover. We assert via the dot/storage to absorb
            // the onTagsChanged row re-render without a fixed delay.
            const checkboxSelector = '.tag-picker--popover input[type="checkbox"][value="t_read"]';
            await page.click(checkboxSelector);
            await page.waitForSelector(`${bookmarkSelector} .bookmark-tag-dot[data-color="green"]`, { timeout: 10000 });
            // Popover must still be in the DOM after the in-menu click.
            await page.waitForSelector('.custom-context-menu .tag-picker--popover', { timeout: 5000 });

            // Uncheck via a second real click -> immediate removal (popover survives the row re-render)
            await page.waitForSelector(checkboxSelector, { timeout: 5000 });
            await page.click(checkboxSelector);
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

    test('should create a new tag via the right-click popover "+ New tag" flow', async () => {
        const bookmark = await page.evaluate(() => {
            return new Promise(resolve => {
                chrome.bookmarks.create({
                    parentId: '1',
                    title: 'Tagging NewTag Bookmark',
                    url: 'https://example.com/tagging-newtag'
                }, resolve);
            });
        });
        const testBookmarkId = bookmark.id;

        try {
            await page.reload();
            await page.waitForSelector('#bookmark-list', { timeout: 10000 });
            await expandBookmarksBar(page);

            const bookmarkSelector = `.bookmark-item[data-bookmark-id="${testBookmarkId}"]`;
            await page.waitForSelector(bookmarkSelector, { timeout: 10000 });

            // Open the custom context menu and the manage-tags popover
            await page.click(bookmarkSelector, { button: 'right' });
            await page.waitForSelector('.custom-context-menu', { timeout: 5000 });
            await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.custom-context-menu .context-menu-item'));
                items[items.length - 1].click();
            });
            await page.waitForSelector('.custom-context-menu .tag-picker--popover', { timeout: 5000 });

            // Click "+ New tag" -> opens a nested .modal-overlay prompt.
            // The nested prompt is OUTSIDE .custom-context-menu, so handleOutside
            // must ignore .modal-overlay clicks and keep the popover alive.
            await page.click('.tag-picker--popover .tag-picker__create');
            await page.waitForSelector('.modal-overlay .modal-input', { timeout: 5000 });

            const newTagName = 'PopoverTag';
            await page.type('.modal-overlay .modal-input', newTagName);
            await page.click('.modal-overlay .confirm-btn');

            // Fix 1: createTagPicker dispatches tagselectionchange after createTag,
            // so the popover listener persists the new tag onto the bookmark.
            // Assert the bookmark row gains a tag dot.
            await page.waitForSelector(`${bookmarkSelector} .bookmark-tag-dot`, { timeout: 10000 });

            // Assert storage bookmarkTags contains the newly created tag id for this bookmark.
            const result = await page.evaluate((id, name) => {
                return new Promise(resolve => {
                    chrome.storage.local.get(['tags', 'bookmarkTags'], (res) => {
                        const tags = res.tags || {};
                        const newTag = Object.values(tags).find(t => t.name === name);
                        const bound = (res.bookmarkTags || {})[id] || [];
                        resolve({ newTagId: newTag ? newTag.id : null, bound });
                    });
                });
            }, testBookmarkId, newTagName);

            expect(result.newTagId).toBeTruthy();
            expect(result.bound).toContain(result.newTagId);
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
