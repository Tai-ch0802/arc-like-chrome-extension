const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

/**
 * Scoped folder duplicate scan (Task 15).
 *
 * Right-clicking a `.bookmark-folder` row opens `.custom-context-menu` with
 * "Find duplicates here" / "Check dead links here". Clicking the first opens the
 * Bookmark Tools modal (`.bm-tools`) on the duplicates tab, scoped to that folder
 * so only duplicates WITHIN the folder subtree are listed.
 *
 * Seed data (all under bookmarks bar id '1'):
 *   ScopedA → two bookmarks with the SAME url (https://dup.example.com/)   → one dup group in A
 *   ScopedB → one unique bookmark + two bookmarks sharing another url
 *             (https://other.example.com/)                                  → one dup group in B
 *
 * The in-memory bookmark cache is rebuilt from chrome.bookmarks.getTree() on
 * sidepanel load, so we seed first then page.reload() for determinism (same
 * pattern the tagging test uses for seeded tags).
 */
describe('Scoped Folder Duplicate Scan Use Case', () => {
    let browser;
    let page;

    const DUP_URL = 'https://dup.example.com/';
    const OTHER_URL = 'https://other.example.com/';

    // Folder ids captured from chrome.bookmarks.create return values.
    let folderAId;
    let folderBId;
    const createdIds = [];

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        // Best-effort cleanup: remove folders recursively (children go with them).
        try {
            for (const id of [folderAId, folderBId]) {
                if (!id) continue;
                await page.evaluate((fid) => new Promise(res => {
                    chrome.bookmarks.removeTree(fid, () => res());
                }), id);
            }
        } catch (e) { /* ignore */ }
        await teardownBrowser(browser);
    });

    /** Creates a node via chrome.bookmarks.create in page context, returns the node. */
    async function createNode(props) {
        return page.evaluate((p) => new Promise(resolve => {
            chrome.bookmarks.create(p, resolve);
        }), props);
    }

    test('seed folders A and B with duplicates', async () => {
        const folderA = await createNode({ parentId: '1', title: 'ScopedA' });
        folderAId = folderA.id;
        createdIds.push(folderAId);
        const a1 = await createNode({ parentId: folderAId, title: 'A dup one', url: DUP_URL });
        const a2 = await createNode({ parentId: folderAId, title: 'A dup two', url: DUP_URL });
        createdIds.push(a1.id, a2.id);

        const folderB = await createNode({ parentId: '1', title: 'ScopedB' });
        folderBId = folderB.id;
        createdIds.push(folderBId);
        const bUnique = await createNode({ parentId: folderBId, title: 'B unique', url: 'https://unique.example.com/' });
        const b1 = await createNode({ parentId: folderBId, title: 'B dup one', url: OTHER_URL });
        const b2 = await createNode({ parentId: folderBId, title: 'B dup two', url: OTHER_URL });
        createdIds.push(bUnique.id, b1.id, b2.id);

        expect(folderAId).toBeTruthy();
        expect(folderBId).toBeTruthy();
    }, 60000);

    test('scoped scan of folder A shows only A duplicates, scope change to All shows both', async () => {
        // Reload so buildBookmarkCache() picks up the seeded nodes.
        await page.reload();
        await page.waitForSelector('#bookmark-list', { timeout: 10000 });
        await expandBookmarksBar(page);

        const folderSelector = `.bookmark-folder[data-bookmark-id="${folderAId}"]`;
        await page.waitForSelector(folderSelector, { timeout: 10000 });

        // 1. Right-click folder A → open custom context menu → "Find duplicates here".
        await page.click(folderSelector, { button: 'right' });
        await page.waitForSelector('.custom-context-menu', { timeout: 5000 });

        // For a folder the first item is "Find duplicates here". Click it directly
        // to avoid i18n coupling (same approach the tagging test uses).
        await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.custom-context-menu .context-menu-item'));
            items[0].click();
        });

        // Modal appears, scoped to folder A's subtree. The context-menu entry
        // now forwards the folder's real title, so the label renders the literal
        // "ScopedA" (folder titles are not translated → locale-independent). The
        // count is also a deterministic scope signal: A holds exactly 2 bookmarks.
        // (Parens may be ASCII "(2)" or fullwidth "（2）" depending on the active
        // UI locale, so match either.)
        await page.waitForSelector('.bm-tools', { timeout: 10000 });
        await page.waitForSelector('.bm-tools__scope-label', { timeout: 5000 });
        await page.waitForFunction(
            () => /[(（]\s*2\s*[)）]/.test(document.querySelector('.bm-tools__scope-label')?.textContent || ''),
            { timeout: 5000 }
        );
        const scopeLabelText = await page.$eval('.bm-tools__scope-label', el => el.textContent || '');
        expect(scopeLabelText).toContain('ScopedA');

        // 2. Duplicates list shows exactly one group, for DUP_URL — NOT OTHER_URL.
        await page.waitForSelector('.bm-tools__dup-group', { timeout: 5000 });
        const scopedGroups = await page.$$eval('.bm-tools__dup-group', els =>
            els.map(el => el.querySelector('.bm-tools__dup-header')?.textContent || '')
        );
        expect(scopedGroups.length).toBe(1);
        expect(scopedGroups[0]).toContain('dup.example.com');
        expect(scopedGroups.join('\n')).not.toContain('other.example.com');

        // 3. Change scope to "All bookmarks" → both groups appear.
        await page.click('.bm-tools__scope-btn');
        // pickFolder opens a second modal containing .modal-bookmark-tree.
        await page.waitForSelector('.modal-bookmark-tree', { timeout: 5000 });
        // The "All bookmarks" row is the first .bookmark-folder in the tree
        // (rendered before any real folder, with id=null → whole-library scope).
        await page.click('.modal-bookmark-tree .bookmark-folder');
        // Confirm the folder picker (its own submit button).
        await page.click('.modal-bookmark-tree ~ .modal-buttons .confirm-btn, .add-bookmark-form .confirm-btn');

        // After scope change the duplicates view re-renders with both groups.
        await page.waitForFunction(
            () => {
                const headers = Array.from(document.querySelectorAll('.bm-tools__dup-group .bm-tools__dup-header'))
                    .map(h => h.textContent);
                const hasDup = headers.some(h => h.includes('dup.example.com'));
                const hasOther = headers.some(h => h.includes('other.example.com'));
                return hasDup && hasOther;
            },
            { timeout: 10000 }
        );

        const allGroups = await page.$$eval('.bm-tools__dup-group', els => els.length);
        expect(allGroups).toBeGreaterThanOrEqual(2);
    }, 120000);
});
