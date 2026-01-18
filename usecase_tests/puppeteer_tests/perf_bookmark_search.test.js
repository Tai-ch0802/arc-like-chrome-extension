const { setupBrowser, teardownBrowser } = require('./setup');

describe.skip('Bookmark Search Performance Benchmark', () => {
    let browser;
    let page;
    let extensionId;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;

        // Wait for api to be exposed
        await page.waitForFunction(() => window.api);
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('Measure searchBookmarksByUrl performance', async () => {
        // 1. Generate Bookmarks
        const NUM_BOOKMARKS = 1000;
        console.log(`Generating ${NUM_BOOKMARKS} bookmarks...`);

        const folderId = await page.evaluate(async (count) => {
             const parentId = '1'; // Bookmarks bar
             const folder = await window.api.createBookmark({
                 parentId: parentId,
                 title: 'PerfTestFolder'
             });

             // Batch creation loop
             for (let i = 0; i < count; i++) {
                 await window.api.createBookmark({
                     parentId: folder.id,
                     title: `PerfTest Bookmark ${i}`,
                     url: `https://perftest.example.com/${i}`
                 });
             }
             return folder.id;
        }, NUM_BOOKMARKS);

        console.log('Bookmarks generated.');

        // 2. Measure Search
        const targetUrl = `https://perftest.example.com/${NUM_BOOKMARKS - 50}`; // pick one deep in the list

        const iterations = 50;
        console.log(`Running search for ${targetUrl} (${iterations} iterations)...`);

        const duration = await page.evaluate(async (url, iters) => {
            const start = performance.now();
            for (let i = 0; i < iters; i++) {
                await window.api.searchBookmarksByUrl(url);
            }
            const end = performance.now();
            return end - start;
        }, targetUrl, iterations);

        console.log(`Total time for ${iterations} searches: ${duration.toFixed(2)}ms`);
        console.log(`Average time per search: ${(duration / iterations).toFixed(2)}ms`);

        // 3. Cleanup
        console.log('Cleaning up bookmarks...');
        await page.evaluate(async (id) => {
            await window.api.removeBookmarkTree(id);
        }, folderId);

        console.log('Cleanup complete.');
    }, 180000); // Keep 3 minutes timeout to be safe
});
