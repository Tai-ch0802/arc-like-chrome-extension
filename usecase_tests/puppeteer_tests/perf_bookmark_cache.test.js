const { setupBrowser, teardownBrowser } = require('./setup');

describe('Bookmark Cache Performance Benchmark', () => {
    let browser;
    let page;
    let extensionId;
    let sidePanelUrl;

    beforeAll(async () => {
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        extensionId = setup.extensionId;
        sidePanelUrl = setup.sidePanelUrl;

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('Measure buildBookmarkCache and loadBookmarkCache performance', async () => {
        const result = await page.evaluate(async () => {
            // Mock chrome.storage.local.set/get to verify usage
            let setCalled = false;
            let getCalled = false;

            // Spy on set - support both Promise and callback API
            const originalSet = chrome.storage.local.set.bind(chrome.storage.local);
            const setSpy = (items, callback) => {
                setCalled = true;
                console.log('SPY: chrome.storage.local.set called');
                // Support Promise API (no callback) and callback API
                const result = originalSet(items, callback);
                return result; // Return promise if no callback provided
            };

            try {
                chrome.storage.local.set = setSpy;
            } catch (e) {
                console.log('Cannot overwrite chrome.storage.local.set directly, trying defineProperty');
                Object.defineProperty(chrome.storage.local, 'set', {
                    value: setSpy,
                    writable: true,
                    configurable: true
                });
            }

            // Spy on get - support both Promise and callback API
            const originalGet = chrome.storage.local.get.bind(chrome.storage.local);
            const getSpy = (keys, callback) => {
                getCalled = true;
                console.log('SPY: chrome.storage.local.get called');
                // Support Promise API (no callback) and callback API
                const result = originalGet(keys, callback);
                return result; // Return promise if no callback provided
            };

            try {
                chrome.storage.local.get = getSpy;
            } catch (e) {
                Object.defineProperty(chrome.storage.local, 'get', {
                    value: getSpy,
                    writable: true,
                    configurable: true
                });
            }

            const state = await import('./modules/stateManager.js');

            // Measure buildBookmarkCache
            const startBuild = performance.now();
            await state.buildBookmarkCache();
            const endBuild = performance.now();

            // Measure loadBookmarkCache
            const startLoad = performance.now();
            await state.loadBookmarkCache();
            const endLoad = performance.now();

            return {
                buildTime: endBuild - startBuild,
                loadTime: endLoad - startLoad,
                setCalled: setCalled,
                getCalled: getCalled
            };
        });

        console.log(`Bookmark Cache Benchmark:`);
        console.log(`  buildBookmarkCache time: ${result.buildTime.toFixed(2)} ms`);
        console.log(`  loadBookmarkCache time: ${result.loadTime.toFixed(2)} ms`);
        console.log(`  Storage SET called: ${result.setCalled}`);
        console.log(`  Storage GET called: ${result.getCalled}`);

        // Verify storage API was used
        expect(result.setCalled).toBe(true);
        expect(result.getCalled).toBe(true);

        // Performance sanity check - should complete within reasonable time
        expect(result.buildTime).toBeLessThan(5000); // 5 seconds max
        expect(result.loadTime).toBeLessThan(1000);  // 1 second max
    }, 120000);
});
