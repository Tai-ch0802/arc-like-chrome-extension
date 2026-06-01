const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

/**
 * E2E coverage for the bookmark-tag color + tag: search enhancements:
 *   1. Tag color dot — a tag seeded with color 'red' renders a
 *      .bookmark-tag-dot[data-color="red"] on its bookmark row.
 *   2. tag: search — typing `tag:Work` filters the bookmark list down to the
 *      tagged bookmark; an untagged bookmark is removed from the DOM.
 *   3. click-dot-to-filter — clicking a .bookmark-tag-dot sets #search-box to
 *      `tag:Work` and filters the list to the tagged bookmark.
 *
 * Determinism: tags + bookmarkTags bindings are seeded directly into
 * chrome.storage.local (the dot reflects tag.color regardless of how the tag
 * was created), so we never have to drive the flaky showTagDialog color picker.
 * tagManager.initTags() reads both keys on load, so we reload after seeding.
 */
describe('Bookmark Tag Color + tag: Search Use Case', () => {
    let browser;
    let page;

    let workBookmarkId;
    let plainBookmarkId;

    const TAG = { id: 't_work', name: 'Work', color: 'red', createdAt: 1700000000000 };

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        // Best-effort cleanup so this suite doesn't pollute sibling tests.
        try {
            await page.evaluate(() => new Promise(resolve => {
                chrome.storage.local.remove(['tags', 'bookmarkTags'], resolve);
            }));
        } catch (e) { }
        for (const id of [workBookmarkId, plainBookmarkId]) {
            if (!id) continue;
            try {
                await page.evaluate((bid) => new Promise(resolve => {
                    chrome.bookmarks.remove(bid, resolve);
                }), id);
            } catch (e) { }
        }
        await teardownBrowser(browser);
    });

    /** Seed two bookmarks + a colored tag + the binding, then reload. */
    async function seedFixture() {
        const ids = await page.evaluate(() => {
            const create = (title, url) => new Promise(resolve => {
                chrome.bookmarks.create({ parentId: '1', title, url }, (n) => resolve(n.id));
            });
            return (async () => {
                const work = await create('Tag Color Work Bookmark', 'https://example.com/tag-color-work');
                const plain = await create('Tag Color Plain Bookmark', 'https://example.com/tag-color-plain');
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

        // Reload so initTags() picks up the seeded tags + bindings.
        await page.reload();
        await page.waitForSelector('#bookmark-list', { timeout: 10000 });
        await expandBookmarksBar(page);

        await page.waitForSelector(`.bookmark-item[data-bookmark-id="${workBookmarkId}"]`, { timeout: 10000 });
        await page.waitForSelector(`.bookmark-item[data-bookmark-id="${plainBookmarkId}"]`, { timeout: 10000 });
    }

    /** Set #search-box value and fire the input event the searchManager listens for. */
    async function typeSearch(value) {
        await page.evaluate((v) => {
            const box = document.getElementById('search-box');
            box.value = v;
            box.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
    }

    test('tag color dot, tag: search filter, and click-dot-to-filter', async () => {
        await seedFixture();

        const workSelector = `.bookmark-item[data-bookmark-id="${workBookmarkId}"]`;
        const plainSelector = `.bookmark-item[data-bookmark-id="${plainBookmarkId}"]`;

        // ---- 1. Tag color dot ----------------------------------------------
        // The seeded tag has color 'red'; the dot must reflect it.
        await page.waitForSelector(`${workSelector} .bookmark-tag-dot[data-color="red"]`, { timeout: 10000 });
        const dotInfo = await page.$eval(
            `${workSelector} .bookmark-tag-dot`,
            (dot) => ({ color: dot.dataset.color, name: dot.dataset.tagName })
        );
        expect(dotInfo.color).toBe('red');
        expect(dotInfo.name).toBe('Work');
        // The untagged bookmark must have no dot.
        const plainDotCount = await page.$$eval(`${plainSelector} .bookmark-tag-dot`, (d) => d.length);
        expect(plainDotCount).toBe(0);

        // ---- 2. tag: search filter -----------------------------------------
        // A `tag:Work` query re-renders the tree with only the tagged bookmark;
        // the untagged bookmark's row is removed from the DOM.
        await typeSearch('tag:Work');
        await page.waitForFunction(
            (wSel, pSel) => !!document.querySelector(wSel) && !document.querySelector(pSel),
            { timeout: 10000 },
            workSelector, plainSelector
        );
        expect(await page.$(workSelector)).not.toBeNull();
        expect(await page.$(plainSelector)).toBeNull();

        // Clear the search and confirm both bookmarks come back.
        await typeSearch('');
        await page.waitForFunction(
            (wSel, pSel) => !!document.querySelector(wSel) && !!document.querySelector(pSel),
            { timeout: 10000 },
            workSelector, plainSelector
        );
        await expandBookmarksBar(page);
        await page.waitForSelector(`${workSelector} .bookmark-tag-dot[data-color="red"]`, { timeout: 10000 });

        // ---- 3. click-dot-to-filter ----------------------------------------
        // Clicking the dot must set #search-box to `tag:Work` and filter the list.
        await page.click(`${workSelector} .bookmark-tag-dot`);
        await page.waitForFunction(
            () => document.getElementById('search-box').value === 'tag:Work',
            { timeout: 5000 }
        );
        const boxValue = await page.$eval('#search-box', (el) => el.value);
        expect(boxValue).toBe('tag:Work');

        await page.waitForFunction(
            (wSel, pSel) => !!document.querySelector(wSel) && !document.querySelector(pSel),
            { timeout: 10000 },
            workSelector, plainSelector
        );
        expect(await page.$(workSelector)).not.toBeNull();
        expect(await page.$(plainSelector)).toBeNull();
    }, 120000);
});
