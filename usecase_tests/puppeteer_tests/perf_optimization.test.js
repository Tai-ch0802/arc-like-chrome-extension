const { setupBrowser, teardownBrowser } = require('./setup');

describe.skip('Performance Benchmark', () => {
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
    });

    afterAll(async () => {
        await teardownBrowser(browser);
    });

    test('Measure renderTabsAndGroups and renderOtherWindowsSection performance with large dataset', async () => {
        // Define mock data size - HIGH DENSITY to stress the O(N*M) algorithm
        const NUM_WINDOWS = 5;
        const TABS_PER_WINDOW = 2000;
        const GROUPS_PER_WINDOW = 200;

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

            // Warmup render (Initial Render)
            tabRenderer.renderTabsAndGroups(currentTabs, currentGroups, { onAddToGroupClick: () => { } });

            // Measure renderTabsAndGroups (Re-render)
            const startTabs = performance.now();
            tabRenderer.renderTabsAndGroups(currentTabs, currentGroups, { onAddToGroupClick: () => { } });
            const endTabs = performance.now();

            // Measure renderOtherWindowsSection
            const startOther = performance.now();
            otherWindowRenderer.renderOtherWindowsSection(otherWindows, currentWindowId, allGroups);
            const endOther = performance.now();

            return {
                tabsTime: endTabs - startTabs,
                otherWindowsTime: endOther - startOther,
                totalTabs: currentTabs.length + otherWindows.reduce((acc, w) => acc + w.tabs.length, 0),
                totalWindows: otherWindows.length + 1
            };
        }, NUM_WINDOWS, TABS_PER_WINDOW, GROUPS_PER_WINDOW);

        console.log(`Benchmark Results (High Density):`);
        console.log(`  Total Windows: ${result.totalWindows}`);
        console.log(`  Total Tabs: ${result.totalTabs}`);
        console.log(`  renderTabsAndGroups: ${result.tabsTime.toFixed(2)} ms`);
        console.log(`  renderOtherWindowsSection: ${result.otherWindowsTime.toFixed(2)} ms`);

        expect(result.tabsTime).toBeGreaterThan(0);
        expect(result.otherWindowsTime).toBeGreaterThan(0);
    });
});
