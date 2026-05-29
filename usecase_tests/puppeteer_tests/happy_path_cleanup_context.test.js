const { setupBrowser, teardownBrowser, expandBookmarksBar } = require('./setup');

/**
 * Dead-link result shows folder path (cleanup context, Task B5).
 *
 * Feature under test: in the Bookmark Tools "Dead Links" tab, after a scan,
 * each unreachable result row shows the bookmark's folder path in a
 * `.bm-tools__dup-path` element (ancestor folder names joined by " / ").
 *
 * Deterministic approach — keep the scan to a single URL so it stays fast and
 * avoids the suspicious-ratio path (which only triggers at totalScanned >= 5):
 *   1. Seed one folder ("DeadScope") under bookmarks bar id '1' containing ONE
 *      bookmark whose URL is guaranteed unreachable:
 *      http://nonexistent.invalid.test/ — the `.invalid` reserved TLD yields
 *      DNS NXDOMAIN, so fetch() throws and the link is classified 'unreachable'.
 *   2. Reload the sidepanel so buildBookmarkCache() picks up the seeded node and
 *      its `path` (same reload pattern as happy_path_scoped_scan).
 *   3. Right-click the folder → "Check dead links here" (the SECOND context-menu
 *      item; the first is "Find duplicates here"). This opens the Bookmark Tools
 *      modal on the deadLinks tab scoped to the folder → the scan sees 1 URL.
 *   4. Click "Start scan" (`.bm-tools__create`) and wait for the unreachable row.
 *   5. Assert an unreachable row exists and its `.bm-tools__dup-path` text
 *      includes the folder name "DeadScope".
 */
describe('Dead-link Result Folder Path Use Case', () => {
    let browser;
    let page;

    const DEAD_URL = 'http://nonexistent.invalid.test/';
    const FOLDER_NAME = 'DeadScope';

    let folderId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        await page.waitForSelector('#bookmark-list', { timeout: 15000 });
    }, 120000);

    afterAll(async () => {
        // Best-effort cleanup: removeTree drops the folder and its child bookmark.
        try {
            if (folderId) {
                await page.evaluate((fid) => new Promise(res => {
                    chrome.bookmarks.removeTree(fid, () => res());
                }), folderId);
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

    test('seed DeadScope folder with one unreachable bookmark', async () => {
        const folder = await createNode({ parentId: '1', title: FOLDER_NAME });
        folderId = folder.id;
        const dead = await createNode({ parentId: folderId, title: 'Dead one', url: DEAD_URL });
        expect(folderId).toBeTruthy();
        expect(dead.id).toBeTruthy();
    }, 60000);

    test('scoped dead-link scan shows unreachable row with folder path', async () => {
        // Reload so buildBookmarkCache() picks up the seeded node (and its path).
        await page.reload();
        await page.waitForSelector('#bookmark-list', { timeout: 10000 });
        await expandBookmarksBar(page);

        const folderSelector = `.bookmark-folder[data-bookmark-id="${folderId}"]`;
        await page.waitForSelector(folderSelector, { timeout: 10000 });

        // Right-click folder → custom context menu. For a folder the items are
        // [0] "Find duplicates here", [1] "Check dead links here". Click [1]
        // directly to avoid i18n coupling (same approach as scoped_scan).
        await page.click(folderSelector, { button: 'right' });
        await page.waitForSelector('.custom-context-menu', { timeout: 5000 });
        await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.custom-context-menu .context-menu-item'));
            items[1].click();
        });

        // Modal opens on the deadLinks tab, scoped to DeadScope (1 bookmark).
        await page.waitForSelector('.bm-tools', { timeout: 10000 });
        await page.waitForSelector('.bm-tools__scope-label', { timeout: 5000 });
        const scopeLabelText = await page.$eval('.bm-tools__scope-label', el => el.textContent || '');
        expect(scopeLabelText).toContain(FOLDER_NAME);

        // Start scan. The deadLinks view's scan button is `.bm-tools__create`.
        await page.waitForSelector('.bm-tools__create', { timeout: 5000 });
        await page.click('.bm-tools__create');

        // Wait for the scan to finish and the unreachable row to render. The
        // single .invalid URL throws on DNS NXDOMAIN → classified 'unreachable'.
        // REQUEST_TIMEOUT_MS is 8s; suite testTimeout is 90s — be generous.
        await page.waitForSelector('.bm-tools__list .bm-tools__row', { timeout: 60000 });

        // Assert: at least one unreachable row, and its path cell names the folder.
        const rowCount = await page.$$eval('.bm-tools__list .bm-tools__row', els => els.length);
        expect(rowCount).toBeGreaterThanOrEqual(1);

        const pathTexts = await page.$$eval('.bm-tools__list .bm-tools__row .bm-tools__dup-path',
            els => els.map(el => el.textContent || ''));
        expect(pathTexts.length).toBeGreaterThanOrEqual(1);
        expect(pathTexts.some(t => t.includes(FOLDER_NAME))).toBe(true);
    }, 90000);
});
