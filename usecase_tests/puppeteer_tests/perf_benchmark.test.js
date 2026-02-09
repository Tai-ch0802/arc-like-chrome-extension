const { setupBrowser, teardownBrowser } = require('./setup');

describe('Performance Benchmark', () => {
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
    }, 120000);

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('Measure renderTabsAndGroups and renderOtherWindowsSection performance with large dataset', async () => {
        // Define mock data size - stress testing but CI-friendly
        const NUM_WINDOWS = 3;
        const TABS_PER_WINDOW = 100;
        const GROUPS_PER_WINDOW = 10;

        // Generate mock data in the browser context to avoid serialization overhead in measurement
        // However, we need to pass the data to the functions.
        // We will generate it inside page.evaluate and then run the test.

        const result = await page.evaluate(async (numWindows, tabsPerWindow, groupsPerWindow) => {
            // Helper to generate tabs
            const generateTabs = (windowId, count, groups) => {
                return Array.from({ length: count }, (_, i) => {
                    // Distribute tabs among groups
                    const groupIndex = i % (groups.length * 2); // Half tabs in groups, half not
                    const groupId = (groupIndex < groups.length) ? groups[groupIndex].id : -1;
                    return {
                        id: windowId * 100000 + i,
                        windowId: windowId,
                        groupId: groupId,
                        title: `Tab ${i} in Window ${windowId}`,
                        url: `https://example.com/${windowId}/${i}`,
                        favIconUrl: '',
                        active: i === 0
                    };
                });
            };

            // Helper to generate groups
            const generateGroups = (windowId, count) => {
                return Array.from({ length: count }, (_, i) => ({
                    id: windowId * 1000 + i + 1, // Ensure > 0
                    windowId: windowId,
                    title: `Group ${i}`,
                    collapsed: false,
                    color: 'blue'
                }));
            };

            // Generate "Current Window" Data
            const currentWindowId = 1;
            const currentGroups = generateGroups(currentWindowId, groupsPerWindow);
            const currentTabs = generateTabs(currentWindowId, tabsPerWindow, currentGroups);

            // Generate "Other Windows" Data
            const otherWindows = [];
            const allGroups = [...currentGroups];

            for (let i = 2; i <= numWindows; i++) {
                const groups = generateGroups(i, groupsPerWindow);
                const tabs = generateTabs(i, tabsPerWindow, groups);
                allGroups.push(...groups);
                otherWindows.push({
                    id: i,
                    tabs: tabs,
                    focused: false
                });
            }

            const tabRenderer = await import('./modules/ui/tabRenderer.js');
            const otherWindowRenderer = await import('./modules/ui/otherWindowRenderer.js');

            // Measure renderTabsAndGroups
            const startTabs = performance.now();
            tabRenderer.renderTabsAndGroups(currentTabs, currentGroups, { onAddToGroupClick: () => { } });
            const endTabs = performance.now();

            // Measure renderOtherWindowsSection
            const startOther = performance.now();
            otherWindowRenderer.renderOtherWindowsSection(otherWindows, currentWindowId, allGroups);
            const endOther = performance.now();

            // Measure UPDATE (re-render with small change)
            currentTabs[0].title = "Updated Title";
            const startUpdate = performance.now();
            tabRenderer.renderTabsAndGroups(currentTabs, currentGroups, { onAddToGroupClick: () => { } });
            const endUpdate = performance.now();

            return {
                tabsTime: endTabs - startTabs,
                updateTime: endUpdate - startUpdate,
                otherWindowsTime: endOther - startOther,
                totalTabs: currentTabs.length + otherWindows.reduce((acc, w) => acc + w.tabs.length, 0),
                totalWindows: otherWindows.length + 1
            };
        }, NUM_WINDOWS, TABS_PER_WINDOW, GROUPS_PER_WINDOW);

        console.log(`Benchmark Results (High Density):`);
        console.log(`  Total Windows: ${result.totalWindows}`);
        console.log(`  Total Tabs: ${result.totalTabs}`);
        console.log(`  renderTabsAndGroups (Initial): ${result.tabsTime.toFixed(2)} ms`);
        console.log(`  renderTabsAndGroups (Update): ${result.updateTime.toFixed(2)} ms`);
        console.log(`  renderOtherWindowsSection: ${result.otherWindowsTime.toFixed(2)} ms`);

        expect(result.tabsTime).toBeGreaterThan(0);
        expect(result.otherWindowsTime).toBeGreaterThan(0);
    }, 90000);

    test('Measure handleSearch highlighting performance with large dataset', async () => {
        const NUM_TABS = 500;
        const SEARCH_KEYWORD = "Tab";

        const result = await page.evaluate(async (numTabs, searchKeyword) => {
            // Setup: Generate tabs
            const tabs = Array.from({ length: numTabs }, (_, i) => ({
                id: i,
                windowId: 1,
                groupId: -1,
                title: `Tab ${i} - This is a long title to simulate real world scenarios`,
                url: `https://example.com/page/${i}`,
                favIconUrl: '',
                active: false
            }));

            // Setup: Render tabs
            const tabRenderer = await import('./modules/ui/tabRenderer.js');
            const searchManager = await import('./modules/searchManager.js');
            // Ensure UI elements exist (searchBox is in sidepanel.html usually, but here we might need to mock or ensure it's there)
            // The setupBrowser loads the extension, so sidepanel.html is loaded.

            // Render tabs
            tabRenderer.renderTabsAndGroups(tabs, [], { onAddToGroupClick: () => { } });

            // Set search box value because handleSearch reads it
            const searchBox = document.getElementById('search-box');
            if (searchBox) {
                searchBox.value = searchKeyword;
            }

            const start = performance.now();
            await searchManager.handleSearch();
            const end = performance.now();

            return {
                executionTime: end - start,
                tabCount: tabs.length
            };
        }, NUM_TABS, SEARCH_KEYWORD);

        console.log(`Benchmark Results (Search):`);
        console.log(`  Total Tabs: ${result.tabCount}`);
        console.log(`  handleSearch execution time: ${result.executionTime.toFixed(2)} ms`);

        expect(result.executionTime).toBeGreaterThan(0);
    }, 90000);
});
