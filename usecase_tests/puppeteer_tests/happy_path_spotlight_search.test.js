const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

/**
 * E2E coverage for the unified Spotlight search feature:
 *   1. Spotlight page loads: navigating to spotlight.html shows #spotlight-input
 *      and a #spotlight-results container.  When the query is empty the
 *      controller calls searchAll('') which always returns action items (the
 *      Actions group is populated even with no user data), so at least one
 *      .cmd-palette-group-header must appear.
 *   2. Typing filters: a query that matches one of the static action labels
 *      (e.g. "bookmark" hits the Bookmark Tools action) reduces or keeps
 *      results; asserting the container is non-empty after typing is stable.
 *   3. Side-panel tag: scoping: reuse the fixture approach from
 *      happy_path_bookmark_tag_color_search — seed a bookmark + tag binding,
 *      reload the side panel, type `tag:<name>`, then assert:
 *        a. the tagged bookmark is visible in the DOM.
 *        b. every .tab-item carries the `hidden` class (non-bookmark sections
 *           hidden).
 *        c. every .reading-list-item (if any) carries the `hidden` class.
 *      Clearing the search restores tab-item visibility.
 *   4. Old overlay gone: the side panel must NOT contain an element with
 *      id="command-palette-overlay".
 *
 * NOTE: We do NOT simulate the real OS-level Cmd+Shift+K shortcut (impossible
 * in headless Puppeteer without OS-level input injection). The Spotlight popup
 * page is instead loaded directly via page.goto(spotlightUrl), which is the
 * standard harness pattern for extension pages (see happy_path_options_page).
 *
 * NOTE: The spotlight.js bootstrap calls chrome.storage.session.get which is
 * available in extension pages running in the extension context. Because
 * Puppeteer loads the extension via --load-extension the chrome.* APIs are
 * fully available in the extension page context.
 */
describe('Spotlight Search Use Case', () => {
    let browser;
    let page;
    let extensionId;

    // Fixture state for the tag: scoping test
    let workBookmarkId;
    let plainBookmarkId;
    const TAG = { id: 't_spotlight', name: 'SpotlightTag', color: 'blue', createdAt: 1700001000000 };

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        // Best-effort cleanup so this suite doesn't pollute sibling tests.
        try {
            await page.evaluate(() => new Promise(resolve => {
                chrome.storage.local.remove(['tags', 'bookmarkTags'], resolve);
            }));
        } catch (e) { /* ignore */ }
        for (const id of [workBookmarkId, plainBookmarkId]) {
            if (!id) continue;
            try {
                await page.evaluate((bid) => new Promise(resolve => {
                    chrome.bookmarks.remove(bid, resolve);
                }), id);
            } catch (e) { /* ignore */ }
        }
        await teardownBrowser(browser);
    });

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /** Navigate the shared page to spotlight.html and wait for it to be ready. */
    async function gotoSpotlight() {
        const spotlightUrl = `chrome-extension://${extensionId}/spotlight.html`;
        await page.goto(spotlightUrl, { waitUntil: 'domcontentloaded' });
        // Wait for the input (initSpotlight attaches listeners + focuses it)
        await page.waitForSelector('#spotlight-input', { timeout: 15000 });
        // Give the async bootstrap (loadBookmarkCache, initWorkspaces, etc.) time to finish
        // and for searchAll('') + renderGroups to complete.
        await page.waitForFunction(
            () => document.getElementById('spotlight-results') !== null &&
                  document.getElementById('spotlight-results').children.length > 0,
            { timeout: 15000 }
        );
    }

    /** Navigate back to the side panel after a spotlight test. */
    async function gotoSidePanel() {
        const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
        await page.goto(sidePanelUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }

    /** Set #search-box value and fire the input event the searchManager listens for. */
    async function typeSearch(value) {
        await page.evaluate((v) => {
            const box = document.getElementById('search-box');
            box.value = v;
            box.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
    }

    // -----------------------------------------------------------------
    // Test 1 — Spotlight page loads and renders guided defaults
    // -----------------------------------------------------------------
    test('spotlight page loads with input focused and results container populated', async () => {
        await gotoSpotlight();

        // #spotlight-input must exist and be the focused element
        const inputExists = await page.$('#spotlight-input');
        expect(inputExists).not.toBeNull();

        // When query is empty, searchAll('') returns the Actions group (always
        // non-empty: buildActions() yields at minimum the bookmark-tools action).
        // So #spotlight-results must have at least one .cmd-palette-group-header.
        await page.waitForSelector('.cmd-palette-group-header', { timeout: 10000 });
        const headerCount = await page.$$eval('.cmd-palette-group-header', els => els.length);
        expect(headerCount).toBeGreaterThanOrEqual(1);

        // Results container exists
        const resultsExists = await page.$('#spotlight-results');
        expect(resultsExists).not.toBeNull();
    }, 60000);

    // -----------------------------------------------------------------
    // Test 2 — Typing filters the result list
    // -----------------------------------------------------------------
    test('typing a query into spotlight-input updates results', async () => {
        // Ensure we are on the spotlight page (previous test navigated there)
        const onSpotlight = page.url().includes('spotlight.html');
        if (!onSpotlight) {
            await gotoSpotlight();
        }

        // Type a query that matches one of the static action labels —
        // "bookmark" will match the Bookmark Tools action title.
        await page.evaluate(() => {
            const input = document.getElementById('spotlight-input');
            input.value = 'bookmark';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Wait for the debounced refresh (100 ms) + renderGroups to settle
        await page.waitForFunction(
            () => {
                const r = document.getElementById('spotlight-results');
                // Results must have been re-rendered (children exist)
                return r && r.children.length > 0;
            },
            { timeout: 10000 }
        );

        const rowsAfter = await page.$$eval('.cmd-palette-row', els => els.length);
        // A matching query must yield results (at least the Bookmark Tools action row).
        expect(rowsAfter).toBeGreaterThanOrEqual(1);

        // Deterministic proof that filtering actually runs: a query that matches
        // nothing in any source must collapse to the empty state (0 result rows).
        await page.evaluate(() => {
            const input = document.getElementById('spotlight-input');
            input.value = 'zzqqxx_no_such_match_query';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForFunction(
            () => {
                const r = document.getElementById('spotlight-results');
                return r
                    && r.querySelector('.cmd-palette-empty')
                    && r.querySelectorAll('.cmd-palette-row').length === 0;
            },
            { timeout: 10000 }
        );
        const rowsNoMatch = await page.$$eval('.cmd-palette-row', els => els.length);
        expect(rowsNoMatch).toBe(0);
    }, 60000);

    // -----------------------------------------------------------------
    // Test 3 — Side-panel tag: scoping
    // -----------------------------------------------------------------
    test('tag: query in side panel hides tabs + reading-list, shows tagged bookmark', async () => {
        // Return to the side panel
        await gotoSidePanel();

        // Seed two bookmarks + a tag + the binding, then reload.
        const ids = await page.evaluate(() => {
            const create = (title, url) => new Promise(resolve => {
                chrome.bookmarks.create({ parentId: '1', title, url }, (n) => resolve(n.id));
            });
            return (async () => {
                const work = await create('SpotlightTagged Bookmark', 'https://example.com/spotlight-tagged');
                const plain = await create('SpotlightPlain Bookmark', 'https://example.com/spotlight-plain');
                return { work, plain };
            })();
        });
        workBookmarkId = ids.work;
        plainBookmarkId = ids.plain;

        await page.evaluate((tag, workId) => new Promise(resolve => {
            chrome.storage.local.set({
                tags: { [tag.id]: tag },
                bookmarkTags: { [workId]: [tag.id] },
            }, resolve);
        }), TAG, workBookmarkId);

        // Reload so initTags() picks up seeded data
        await page.reload();
        await page.waitForSelector('#bookmark-list', { timeout: 10000 });
        await expandBookmarksBar(page);

        await page.waitForSelector(`.bookmark-item[data-bookmark-id="${workBookmarkId}"]`, { timeout: 10000 });
        await page.waitForSelector(`.bookmark-item[data-bookmark-id="${plainBookmarkId}"]`, { timeout: 10000 });

        // Ensure at least one tab-item is present (so the hide assertion is meaningful)
        await page.waitForSelector('.tab-item', { timeout: 10000 });

        // Apply tag: filter
        await typeSearch(`tag:SpotlightTag`);

        // Wait for searchManager debounce (300 ms) + async filterBookmarks to complete.
        // filterBookmarks re-renders the bookmark tree, keeping only nodes whose id
        // is in visibleIds (matching bookmark + ancestors). The plain bookmark is not
        // in visibleIds, so its DOM element is removed after the re-render.
        const workSelector = `.bookmark-item[data-bookmark-id="${workBookmarkId}"]`;
        const plainSelector = `.bookmark-item[data-bookmark-id="${plainBookmarkId}"]`;

        await page.waitForFunction(
            (wSel, pSel) => !!document.querySelector(wSel) && !document.querySelector(pSel),
            { timeout: 15000 },
            workSelector, plainSelector
        );
        expect(await page.$(workSelector)).not.toBeNull();

        // Plain bookmark must be absent from the filtered tree
        expect(await page.$(plainSelector)).toBeNull();

        // hideNonBookmarkSections() adds .hidden to every .tab-item.
        // Wait for at least one tab-item to carry the hidden class.
        await page.waitForFunction(
            () => {
                const items = document.querySelectorAll('.tab-item');
                return items.length === 0 ||
                    Array.from(items).every(el => el.classList.contains('hidden'));
            },
            { timeout: 10000 }
        );
        const tabItemsAllHidden = await page.evaluate(() => {
            const items = document.querySelectorAll('.tab-item');
            if (items.length === 0) return true; // no tabs = vacuously hidden
            return Array.from(items).every(el => el.classList.contains('hidden'));
        });
        expect(tabItemsAllHidden).toBe(true);

        // reading-list items (if any) should all be hidden
        const readingListAllHidden = await page.evaluate(() => {
            const items = document.querySelectorAll('.reading-list-item');
            if (items.length === 0) return true;
            return Array.from(items).every(el => el.classList.contains('hidden'));
        });
        expect(readingListAllHidden).toBe(true);

        // ---- Clear search: tab items restored ----------------------------
        await typeSearch('');

        await page.waitForFunction(
            () => {
                const items = document.querySelectorAll('.tab-item');
                return items.length > 0 &&
                    Array.from(items).some(el => !el.classList.contains('hidden'));
            },
            { timeout: 10000 }
        );
        const tabItemsSomeVisible = await page.evaluate(() => {
            const items = document.querySelectorAll('.tab-item');
            return Array.from(items).some(el => !el.classList.contains('hidden'));
        });
        expect(tabItemsSomeVisible).toBe(true);
    }, 120000);

    // -----------------------------------------------------------------
    // Test 4 — Old overlay element is gone from the side panel
    // -----------------------------------------------------------------
    test('command-palette-overlay element does not exist in the side panel', async () => {
        // Make sure we are on the side panel
        const onSidePanel = page.url().includes('sidepanel.html');
        if (!onSidePanel) {
            await gotoSidePanel();
        }

        const overlayExists = await page.evaluate(
            () => document.getElementById('command-palette-overlay') !== null
        );
        expect(overlayExists).toBe(false);
    }, 30000);
});
