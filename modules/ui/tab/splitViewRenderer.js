/**
 * Split-view rendering: detects Chrome split-view tabs (same splitViewId)
 * and renders them inside a shared `.tab-split-group` container.
 * Single-tab splits fall back to normal rendering.
 *
 * Pure module: caller provides caches and the per-tab element factory.
 */
import { reconcileDOM } from '../../utils/domUtils.js';

/**
 * Builds a Map<splitViewId, Tab[]> from the current tab list.
 * @param {chrome.tabs.Tab[]} tabs
 * @returns {Map<number, chrome.tabs.Tab[]>}
 */
export function buildSplitTabsMap(tabs) {
    const map = new Map();
    for (const tab of tabs) {
        if (tab.splitViewId && tab.splitViewId > 0) {
            if (!map.has(tab.splitViewId)) {
                map.set(tab.splitViewId, []);
            }
            map.get(tab.splitViewId).push(tab);
        }
    }
    return map;
}

/**
 * Creates a render function bound to the current render-cycle context.
 * The returned function decides per-tab whether to wrap in a split-group
 * or fall through to a normal tab element.
 *
 * @param {{
 *   splitTabsMap: Map<number, chrome.tabs.Tab[]>,
 *   splitGroupElementsCache: Map<number, HTMLElement>,
 *   newSplitGroupElementsCache: Map<number, HTMLElement>,
 *   renderedTabIds: Set<number>,
 *   getOrCreateTabElement: (tab: chrome.tabs.Tab) => HTMLElement,
 * }} ctx
 * @returns {(tab: chrome.tabs.Tab, targetArray: HTMLElement[]) => void}
 */
export function createSplitOrTabRenderer(ctx) {
    return function renderSplitOrTab(tab, targetArray) {
        if (ctx.renderedTabIds.has(tab.id)) return;

        if (tab.splitViewId && tab.splitViewId > 0) {
            const splitTabs = ctx.splitTabsMap.get(tab.splitViewId);

            if (splitTabs && splitTabs.length > 1) {
                let splitGroup = ctx.splitGroupElementsCache.get(tab.splitViewId);
                if (!splitGroup) {
                    splitGroup = document.createElement('div');
                    splitGroup.className = 'tab-split-group';
                }
                ctx.newSplitGroupElementsCache.set(tab.splitViewId, splitGroup);

                const splitChildren = [];
                splitTabs.forEach(splitTab => {
                    const tabElement = ctx.getOrCreateTabElement(splitTab);
                    tabElement.classList.add('in-split-view');
                    splitChildren.push(tabElement);
                    ctx.renderedTabIds.add(splitTab.id);
                });
                reconcileDOM(splitGroup, splitChildren);

                targetArray.push(splitGroup);
                return;
            }
        }

        // Not split, or only one tab in the split → render as a normal tab.
        const tabElement = ctx.getOrCreateTabElement(tab);
        tabElement.classList.remove('in-split-view');
        targetArray.push(tabElement);
        ctx.renderedTabIds.add(tab.id);
    };
}
