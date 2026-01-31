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
    }, 60000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('Measure buildBookmarkCache and loadBookmarkCache performance', async () => {
        const result = await page.evaluate(async () => {
             // Mock chrome.storage.local.set/get to verify usage
             let setCalled = false;
             // Capture original methods
             // Note: in puppeteer context, we might need to be careful not to break other things if they run in parallel

             // Spy on set
             const originalSet = chrome.storage.local.set;
             const setSpy = (items, callback) => {
                 setCalled = true;
                 console.log('SPY: chrome.storage.local.set called');
                 if (originalSet) originalSet.call(chrome.storage.local, items, callback);
                 else if (callback) callback();
             };

             try {
                 chrome.storage.local.set = setSpy;
             } catch (e) {
                 console.log('Cannot overwrite chrome.storage.local.set directly, trying defineProperty');
                 Object.defineProperty(chrome.storage.local, 'set', {
                     value: setSpy,
                     writable: true
                 });
             }

             // Spy on get
             let getCalled = false;
             const originalGet = chrome.storage.local.get;
             const getSpy = (keys, callback) => {
                 getCalled = true;
                 console.log('SPY: chrome.storage.local.get called');
                 if (originalGet) originalGet.call(chrome.storage.local, keys, callback);
                 else if (callback) callback({});
             };

             try {
                 chrome.storage.local.get = getSpy;
             } catch (e) {
                 Object.defineProperty(chrome.storage.local, 'get', {
                     value: getSpy,
                     writable: true
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

        expect(result.setCalled).toBe(true);
        expect(result.getCalled).toBe(true);
    }, 60000);
});
