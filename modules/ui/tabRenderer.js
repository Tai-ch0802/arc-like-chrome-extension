import * as api from '../apiManager.js';
import * as state from '../stateManager.js';
import { ADD_TO_GROUP_ICON_SVG, BOOKMARK_ICON_SVG, PIN_ICON_SVG, renderIcon } from '../icons.js';
import { tabListContainer } from './elements.js';
import { GROUP_COLORS, hexToRgba } from './groupColors.js';
import { reconcileDOM } from '../utils/domUtils.js';
import { initTabListeners, resetTabListeners as resetListeners } from './tab/tabListeners.js';
import { buildSplitTabsMap, createSplitOrTabRenderer } from './tab/splitViewRenderer.js';
import { getGroupMetaCache, buildSyntheticGroupView } from '../groupMetaCache.js';

/**
 * Module-level state for event delegation and render-cycle caching.
 * Caches are reassigned per render; listeners read them via getter to see latest.
 */

/** @type {Function|null} Set per renderTabsAndGroups call, read by listeners on click. */
let currentAddToGroupCallback = null;
/** @type {import('../groupMetaCache.js').GroupMetaCache|null} Set per render; listeners store synthetic-group collapse through it. */
let currentGroupMeta = null;

/** @type {Map<number, chrome.tabs.Tab>} */
let tabsCache = new Map();
/** @type {Map<number, HTMLElement>} */
let tabElementsCache = new Map();
/** @type {Map<number, HTMLElement>} */
let groupHeaderElementsCache = new Map();
/** @type {Map<number, HTMLElement>} */
let groupContentElementsCache = new Map();
/** @type {Map<number, HTMLElement>} */
let splitGroupElementsCache = new Map();

/**
 * Resets listeners and all render caches. For tests / container replacement.
 */
export function resetTabListeners() {
    resetListeners();
    currentAddToGroupCallback = null;
    currentGroupMeta = null;
    tabsCache = new Map();
    tabElementsCache = new Map();
    groupHeaderElementsCache = new Map();
    groupContentElementsCache = new Map();
    splitGroupElementsCache = new Map();
}

/**
 * Returns the current cache of tab objects.
 * @returns {Map<number, chrome.tabs.Tab>}
 */
export function getTabCache() {
    return tabsCache;
}

/**
 * Returns the current cache of tab DOM elements.
 * @returns {Map<number, HTMLElement>}
 */
export function getTabElementsCache() {
    return tabElementsCache;
}

/**
 * Returns the current cache of group header DOM elements.
 * @returns {Map<number, HTMLElement>}
 */
export function getGroupHeaderElementsCache() {
    return groupHeaderElementsCache;
}

function updateTabElement(tabItem, tab, displayGroupId = tab.groupId, syntheticGroupId = -1) {
    const isActive = tab.active;
    const hasActiveClass = tabItem.classList.contains('active');
    if (isActive && !hasActiveClass) {
        tabItem.classList.add('active');
        tabItem.setAttribute('aria-selected', 'true');
    } else if (!isActive && hasActiveClass) {
        tabItem.classList.remove('active');
        tabItem.removeAttribute('aria-selected');
    }

    if (tabItem.dataset.url !== tab.url) tabItem.dataset.url = tab.url;
    if (tabItem.dataset.windowId !== String(tab.windowId)) tabItem.dataset.windowId = tab.windowId;

    const currentGroupId = tabItem.dataset.groupId ? parseInt(tabItem.dataset.groupId) : -1;
    const newGroupId = displayGroupId > 0 ? displayGroupId : -1;
    if (currentGroupId !== newGroupId) {
        if (newGroupId > 0) tabItem.dataset.groupId = newGroupId;
        else delete tabItem.dataset.groupId;
    }
    // ISSUE-263: a row inside a synthetic group carries its id separately, so
    // drag/drop and tabListeners (which key group ops on dataset.groupId) leave it alone.
    const currentSyntheticId = tabItem.dataset.syntheticGroupId ? parseInt(tabItem.dataset.syntheticGroupId) : -1;
    const newSyntheticId = syntheticGroupId > 0 ? syntheticGroupId : -1;
    if (currentSyntheticId !== newSyntheticId) {
        if (newSyntheticId > 0) tabItem.dataset.syntheticGroupId = newSyntheticId;
        else delete tabItem.dataset.syntheticGroupId;
    }

    let urlPreview = tab.url;
    if (urlPreview && urlPreview.length > 300) {
        urlPreview = urlPreview.substring(0, 300) + '...';
    }
    const newTitleTooltip = `${tab.title}\n${urlPreview}`;
    // Hover Summarize may have stashed this row's native title (see
    // hoverTooltip.suppressAnchorTitle) to stop the browser tooltip from
    // covering its summary popup. While stashed, keep the stash fresh instead
    // of writing the live attribute, so a mid-hover re-render doesn't bring the
    // native tooltip back.
    if (tabItem.dataset.hoverNativeTitle !== undefined) {
        if (tabItem.dataset.hoverNativeTitle !== newTitleTooltip) {
            tabItem.dataset.hoverNativeTitle = newTitleTooltip;
            tabItem.setAttribute('aria-label', tab.title);
        }
    } else if (tabItem.title !== newTitleTooltip) {
        tabItem.title = newTitleTooltip;
        tabItem.setAttribute('aria-label', tab.title);
    }

    const titleSpan = tabItem._refs ? tabItem._refs.title : tabItem.querySelector('.tab-title');
    if (titleSpan && titleSpan.textContent !== tab.title) {
        titleSpan.textContent = tab.title || 'Loading...';
        delete titleSpan.dataset.originalText;
    }

    const favicon = tabItem._refs ? tabItem._refs.favicon : tabItem.querySelector('.tab-favicon');
    if (favicon) {
        const newSrc = (tab.favIconUrl && tab.favIconUrl.startsWith('http')) ? tab.favIconUrl : 'icons/fallback-favicon.svg';
        const currentSrc = favicon.getAttribute('src');
        if (currentSrc !== newSrc && !currentSrc?.endsWith(newSrc)) {
            favicon.src = newSrc;
        }
    }
}

function updateGroupHeaderElement(header, group) {
    const isCollapsed = group.collapsed;
    const wasCollapsed = header.dataset.collapsed === 'true';

    if (isCollapsed !== wasCollapsed) {
        header.setAttribute('aria-expanded', (!isCollapsed).toString());
        header.dataset.collapsed = isCollapsed ? 'true' : 'false';
        const arrow = header.querySelector('.tab-group-arrow');
        if (arrow) arrow.classList.toggle('is-collapsed', isCollapsed);
    }

    // Synthetic groups (ISSUE-263) carry a tooltip that may add a recovery hint.
    const tooltip = group.tooltip || group.title;
    if (header.title !== tooltip) header.title = tooltip;

    const titleSpan = header.querySelector('.tab-group-title');
    if (titleSpan && titleSpan.textContent !== group.title) {
        titleSpan.textContent = group.title;
    }

    const colorDot = header.querySelector('.tab-group-color-dot');
    const groupColorHex = GROUP_COLORS[group.color] || '#5f6368';
    if (colorDot) {
        colorDot.style.backgroundColor = groupColorHex;
        header.style.setProperty('--group-bg-color', hexToRgba(groupColorHex, 0.2));
        header.style.setProperty('--group-bg-hover-color', hexToRgba(groupColorHex, 0.35));
    }
}

/**
 * Builds a group header. `view` is a chrome.tabGroups.TabGroup, or the object
 * buildSyntheticGroupView() returns for a group the browser hides (ISSUE-263).
 * @param {{id:number, title:string, color:string, collapsed:boolean, tooltip?:string}} view
 * @param {boolean} synthetic
 */
function createGroupHeaderElement(view, synthetic) {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'tab-group-header' + (synthetic ? ' is-synthetic' : '');
    groupHeader.tabIndex = 0;
    groupHeader.setAttribute('role', 'button');
    // 初始狀態必須在建立時就寫齊(ISSUE-162 C5):updateGroupHeaderElement
    // 只在 isCollapsed 變化時更新,新建的「展開」header 會卡在
    // 無 aria-expanded 的狀態(role=button 卻沒有開合語意)。
    groupHeader.setAttribute('aria-expanded', (!view.collapsed).toString());
    groupHeader.dataset.collapsed = view.collapsed ? 'true' : 'false';
    // A synthetic header must NOT carry dataset.groupId: dragDropManager /
    // tabListeners / searchManager read that as "a real group the API can act on".
    if (synthetic) groupHeader.dataset.syntheticGroupId = view.id;
    else groupHeader.dataset.groupId = view.id;

    const arrow = document.createElement('span');
    arrow.className = 'tab-group-arrow is-chevron' + (view.collapsed ? ' is-collapsed' : '');
    arrow.innerHTML = renderIcon('expand_more', { size: 16 });

    const colorDot = document.createElement('div');
    colorDot.className = 'tab-group-color-dot';

    const title = document.createElement('span');
    title.className = 'tab-group-title';

    groupHeader.appendChild(arrow);
    groupHeader.appendChild(colorDot);
    if (synthetic) groupHeader.insertAdjacentHTML('beforeend', PIN_ICON_SVG); // static, trusted markup
    groupHeader.appendChild(title);

    updateGroupHeaderElement(groupHeader, view);
    return groupHeader;
}

export function createTabElement(tab, { onAddToGroupClick, displayGroupId = tab.groupId, syntheticGroupId = -1 }) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    if (tab.active) {
        tabItem.classList.add('active');
        tabItem.setAttribute('aria-selected', 'true');
    }
    tabItem.tabIndex = 0; // Make tab focusable
    tabItem.setAttribute('role', 'button');
    tabItem.dataset.tabId = tab.id;
    tabItem.dataset.url = tab.url;
    tabItem.dataset.windowId = tab.windowId;
    if (displayGroupId > 0) {
        tabItem.dataset.groupId = displayGroupId;
    }
    if (syntheticGroupId > 0) {
        tabItem.dataset.syntheticGroupId = syntheticGroupId;
    }

    let urlPreview = tab.url;
    if (urlPreview && urlPreview.length > 300) {
        urlPreview = urlPreview.substring(0, 300) + '...';
    }
    tabItem.title = `${tab.title}\n${urlPreview}`;
    tabItem.setAttribute('aria-label', tab.title);
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.alt = "";
    if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
        favicon.src = tab.favIconUrl;
    } else {
        favicon.src = 'icons/fallback-favicon.svg';
    }
    favicon.onerror = () => {
        favicon.src = 'icons/fallback-favicon.svg';
    };
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'Loading...';

    // 創建 title 容器，用於包裹 title 和可能的 domain
    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'tab-content-wrapper';
    titleWrapper.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.tabIndex = -1;
    closeBtn.dataset.action = 'close';
    const closeTabLabel = api.getMessage("closeTab") || "Close Tab";
    closeBtn.title = closeTabLabel;
    closeBtn.setAttribute('aria-label', closeTabLabel);

    const addToGroupBtn = document.createElement('button');
    addToGroupBtn.className = 'add-to-group-btn';
    addToGroupBtn.innerHTML = ADD_TO_GROUP_ICON_SVG;
    addToGroupBtn.tabIndex = -1;
    addToGroupBtn.dataset.action = 'add-to-group';
    const addToGroupLabel = api.getMessage("addToGroup") || "Add tab to new group";
    addToGroupBtn.title = addToGroupLabel;
    addToGroupBtn.setAttribute('aria-label', addToGroupLabel);

    const addToBookmarkBtn = document.createElement('button');
    addToBookmarkBtn.className = 'add-to-bookmark-btn';
    addToBookmarkBtn.innerHTML = BOOKMARK_ICON_SVG;
    addToBookmarkBtn.tabIndex = -1;
    addToBookmarkBtn.dataset.action = 'add-to-bookmark';
    const addToBookmarkLabel = api.getMessage("addBookmark") || "Add to bookmarks";
    addToBookmarkBtn.title = addToBookmarkLabel;
    addToBookmarkBtn.setAttribute('aria-label', addToBookmarkLabel);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'tab-actions';
    // ISSUE-257: no "add to group" affordance where the browser cannot group tabs.
    if (state.isTabGroupingAvailable()) actionsContainer.appendChild(addToGroupBtn);
    actionsContainer.appendChild(addToBookmarkBtn);
    actionsContainer.appendChild(closeBtn);

    tabItem.appendChild(favicon);
    tabItem.appendChild(titleWrapper);
    tabItem.appendChild(actionsContainer);

    // Cache DOM references to avoid repeated querySelector calls
    tabItem._refs = {
        favicon,
        title,
        titleWrapper
    };

    return tabItem;
}

/**
 * @param {chrome.tabs.Tab[]} tabs current-window tabs in index order
 * @param {chrome.tabGroups.TabGroup[]} groups groups the browser reports for this window
 * @param {{ onAddToGroupClick: Function, groupMeta?: object }} options
 *   groupMeta (ISSUE-263): title/color cache + local collapse state for groups
 *   the browser hides; defaults to the chrome.storage-backed instance.
 */
export function renderTabsAndGroups(tabs, groups, { onAddToGroupClick, groupMeta = getGroupMetaCache() }) {
    initTabListeners(tabListContainer, {
        getTabsCache: () => tabsCache,
        getAddToGroupCallback: () => currentAddToGroupCallback,
        getGroupMeta: () => currentGroupMeta,
    });
    currentAddToGroupCallback = onAddToGroupClick;
    currentGroupMeta = groupMeta;

    // Update cache with full tab objects
    tabsCache = new Map(tabs.map(t => [t.id, t]));

    // New caches for this render cycle
    const newTabElementsCache = new Map();
    const newGroupHeaderElementsCache = new Map();
    const newGroupContentElementsCache = new Map();
    const newSplitGroupElementsCache = new Map();

    const groupsMap = new Map(groups.map(group => [group.id, group]));

    // Optimization: Pre-group tabs by groupId
    const tabsByGroup = new Map();
    for (const tab of tabs) {
        if (tab.groupId > 0) {
            if (!tabsByGroup.has(tab.groupId)) {
                tabsByGroup.set(tab.groupId, []);
            }
            tabsByGroup.get(tab.groupId).push(tab);
        }
    }

    const renderedTabIds = new Set();
    const topLevelChildren = [];

    const splitTabsMap = buildSplitTabsMap(tabs);

    // A tab whose group is missing from `groups` belongs to a group the browser
    // hides from the tabGroups API (Dia pinned group — groupId stays on the tab;
    // Chrome hits this for one frame when a group is created between the two
    // queries behind a render). It is rendered under a SYNTHETIC header
    // (ISSUE-263) and its row carries dataset.syntheticGroupId instead of
    // dataset.groupId, which drag/drop and search read as "a real group".
    const knownGroupIdFor = (tab) => (tab.groupId > 0 && groupsMap.has(tab.groupId)) ? tab.groupId : -1;
    const syntheticGroupIdFor = (tab) => (tab.groupId > 0 && !groupsMap.has(tab.groupId)) ? tab.groupId : -1;

    // Helper to get or create tab element
    const getOrCreateTabElement = (tab) => {
        const displayGroupId = knownGroupIdFor(tab);
        const syntheticGroupId = syntheticGroupIdFor(tab);
        let tabElement = tabElementsCache.get(tab.id);
        if (tabElement) {
            updateTabElement(tabElement, tab, displayGroupId, syntheticGroupId);
        } else {
            tabElement = createTabElement(tab, { onAddToGroupClick, displayGroupId, syntheticGroupId });
        }
        newTabElementsCache.set(tab.id, tabElement);
        return tabElement;
    };

    const renderSplitOrTab = createSplitOrTabRenderer({
        splitTabsMap,
        splitGroupElementsCache,
        newSplitGroupElementsCache,
        renderedTabIds,
        getOrCreateTabElement,
    });

    for (const tab of tabs) {
        if (renderedTabIds.has(tab.id)) {
            continue;
        }

        if (tab.groupId > 0) {
            const group = groupsMap.get(tab.groupId);
            // Optimization: Use pre-grouped tabs
            const tabsInThisGroup = tabsByGroup.get(tab.groupId) || [];
            // Group the browser does not report → rebuild it from membership (ISSUE-263).
            const synthetic = !group;
            const view = group || buildSyntheticGroupView(tab.groupId, tabsInThisGroup, groupMeta, api.getMessage);

            let groupHeader = groupHeaderElementsCache.get(view.id);
            // Same id, other kind (Dia unpinned / re-pinned the group): rebuild the header.
            if (groupHeader && groupHeader.classList.contains('is-synthetic') !== synthetic) groupHeader = undefined;
            if (groupHeader) {
                updateGroupHeaderElement(groupHeader, view);
            } else {
                groupHeader = createGroupHeaderElement(view, synthetic);
            }

            if (!synthetic) groupHeader.dataset.groupId = view.id; // Ensure ID is set
            newGroupHeaderElementsCache.set(view.id, groupHeader);
            topLevelChildren.push(groupHeader);

            // Get or create groupContent container
            let groupContent = groupContentElementsCache.get(view.id);
            if (!groupContent || groupContent.classList.contains('is-synthetic') !== synthetic) {
                groupContent = document.createElement('div');
                groupContent.className = 'tab-group-content' + (synthetic ? ' is-synthetic' : '');
            }
            groupContent.style.display = view.collapsed ? 'none' : 'block';
            newGroupContentElementsCache.set(view.id, groupContent);

            const groupChildren = [];
            for (const groupTab of tabsInThisGroup) {
                renderSplitOrTab(groupTab, groupChildren);
            }
            reconcileDOM(groupContent, groupChildren);

            topLevelChildren.push(groupContent);

        } else {
            renderSplitOrTab(tab, topLevelChildren);
        }
    }

    // Reconcile top-level container
    reconcileDOM(tabListContainer, topLevelChildren);

    // Update caches
    tabElementsCache = newTabElementsCache;
    groupHeaderElementsCache = newGroupHeaderElementsCache;
    groupContentElementsCache = newGroupContentElementsCache;
    splitGroupElementsCache = newSplitGroupElementsCache;
}
