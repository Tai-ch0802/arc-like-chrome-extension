import * as api from '../apiManager.js';
import { ADD_TO_GROUP_ICON_SVG, BOOKMARK_ICON_SVG } from '../icons.js';
import { tabListContainer } from './elements.js';
import { showContextMenu } from './contextMenuManager.js';
import { GROUP_COLORS, hexToRgba } from './groupColors.js';

/**
 * Module-level state for event delegation.
 * These are intentionally module-scoped to persist across renders.
 */

/** @type {Function|null} Callback for adding a tab to a group, set during renderTabsAndGroups */
let currentAddToGroupCallback = null;

/** @type {boolean} Flag to ensure event listeners are only initialized once */
let listenersInitialized = false;

/** @type {Map<number, chrome.tabs.Tab>} Cache of tab objects for event delegation handlers */
let tabsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of tab DOM elements for performance optimization */
let tabElementsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of group header DOM elements for performance optimization */
let groupHeaderElementsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of group content container DOM elements for performance optimization */
let groupContentElementsCache = new Map();

/** @type {AbortController|null} Controller to abort event listeners when resetting */
let listenerAbortController = null;

/**
 * Resets the tab list listeners and module state.
 * Useful for testing, hot-reload, or when the container element is replaced.
 * @returns {void}
 */
export function resetTabListeners() {
    if (listenerAbortController) {
        listenerAbortController.abort();
        listenerAbortController = null;
    }
    listenersInitialized = false;
    currentAddToGroupCallback = null;
    tabsCache = new Map();
    tabElementsCache = new Map();
    groupHeaderElementsCache = new Map();
    groupContentElementsCache = new Map();
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

function initTabListeners(container) {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // Create AbortController for cleanup support
    listenerAbortController = new AbortController();
    const { signal } = listenerAbortController;

    // Helper to find tab data from cache
    const getTabFromElement = (element) => {
        const tabItem = element.closest('.tab-item');
        if (!tabItem) return null;
        const tabId = parseInt(tabItem.dataset.tabId);
        return tabsCache.get(tabId);
    };

    // Helper to find group data
    const getGroupData = (element) => {
        const header = element.closest('.tab-group-header');
        if (!header) return null;
        return {
            id: parseInt(header.dataset.groupId),
            collapsed: header.dataset.collapsed === 'true',
            element: header
        };
    };

    // --- Click Delegation ---
    container.addEventListener('click', async (e) => {
        // Handle Button Clicks
        const button = e.target.closest('button');
        if (button) {
            e.stopPropagation();
            const action = button.dataset.action;
            const tab = getTabFromElement(button);

            if (!tab) return;

            if (action === 'close') {
                api.removeTab(tab.id);
            } else if (action === 'add-to-group') {
                if (currentAddToGroupCallback) {
                    currentAddToGroupCallback(tab.id);
                }
            } else if (action === 'add-to-bookmark') {
                const modal = await import('../modalManager.js');
                const result = await modal.showAddToBookmarkDialog({
                    name: tab.title,
                    url: tab.url
                });
                if (result) {
                    await api.createBookmark(result);
                }
            }
            return;
        }

        // Handle Group Header Click
        const groupData = getGroupData(e.target);
        if (groupData) {
            const header = groupData.element;
            const content = header.nextElementSibling;
            const arrow = header.querySelector('.tab-group-arrow');

            const newCollapsedState = !groupData.collapsed;
            content.style.display = newCollapsedState ? 'none' : 'block';
            arrow.textContent = newCollapsedState ? '▶' : '▼';
            header.setAttribute('aria-expanded', (!newCollapsedState).toString());
            header.dataset.collapsed = newCollapsedState ? 'true' : 'false';

            api.updateTabGroup(groupData.id, { collapsed: newCollapsedState });
            return;
        }

        // Handle Tab Click (Activation)
        const tab = getTabFromElement(e.target);
        if (tab) {
            api.updateTab(tab.id, { active: true });
            api.updateWindow(tab.windowId, { focused: true });
        }
    }, { signal });

    // --- Keydown Delegation ---
    container.addEventListener('keydown', (e) => {
        const tabItem = e.target.closest('.tab-item');
        const groupHeader = e.target.closest('.tab-group-header');

        if (tabItem) {
            // Prevent handling if focus is on a button inside the tab
            if (e.target.tagName === 'BUTTON') return;

            const tab = getTabFromElement(tabItem);
            if (!tab) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                api.updateTab(tab.id, { active: true });
                api.updateWindow(tab.windowId, { focused: true });
            } else if (e.key === 'Delete') {
                e.preventDefault();
                e.stopPropagation();
                api.removeTab(tab.id);
            } else if (e.key === ' ') {
                e.preventDefault();
                const existingMenu = document.querySelector('.custom-context-menu');
                if (existingMenu) {
                    existingMenu.remove();
                } else {
                    const rect = tabItem.getBoundingClientRect();
                    showContextMenu(rect.left + 20, rect.bottom, tab, tabItem);
                }
            }
        } else if (groupHeader) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                groupHeader.click();
            }
        }
    }, { signal });

    // --- Context Menu Delegation ---
    container.addEventListener('contextmenu', (e) => {
        const tab = getTabFromElement(e.target);
        const tabItem = e.target.closest('.tab-item');
        if (tab && tabItem) {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, tab, tabItem);
        }
    }, { signal });

    // --- Focus In (scrolling) ---
    container.addEventListener('focusin', (e) => {
        const tabItem = e.target.closest('.tab-item');
        if (tabItem) {
            setTimeout(() => {
                tabItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 0);
        }
    }, { signal });
}

function updateTabElement(tabItem, tab) {
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
    const newGroupId = tab.groupId > 0 ? tab.groupId : -1;
    if (currentGroupId !== newGroupId) {
        if (newGroupId > 0) tabItem.dataset.groupId = newGroupId;
        else delete tabItem.dataset.groupId;
    }

    let urlPreview = tab.url;
    if (urlPreview && urlPreview.length > 300) {
        urlPreview = urlPreview.substring(0, 300) + '...';
    }
    const newTitleTooltip = `${tab.title}\n${urlPreview}`;
    if (tabItem.title !== newTitleTooltip) {
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
        if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
    }

    if (header.title !== group.title) header.title = group.title;

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

export function createTabElement(tab, { onAddToGroupClick }) {
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
    if (tab.groupId > 0) {
        tabItem.dataset.groupId = tab.groupId;
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
    actionsContainer.appendChild(addToGroupBtn);
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

export function renderTabsAndGroups(tabs, groups, { onAddToGroupClick }) {
    if (!listenersInitialized) {
        initTabListeners(tabListContainer);
    }
    currentAddToGroupCallback = onAddToGroupClick;

    // Update cache with full tab objects
    tabsCache = new Map(tabs.map(t => [t.id, t]));

    // New caches for this render cycle
    const newTabElementsCache = new Map();
    const newGroupHeaderElementsCache = new Map();
    const newGroupContentElementsCache = new Map();

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
    // Use DocumentFragment to batch DOM updates
    const fragment = document.createDocumentFragment();
    const splitTabsMap = new Map();
    for (const tab of tabs) {
        if (tab.splitViewId && tab.splitViewId > 0) {
            if (!splitTabsMap.has(tab.splitViewId)) {
                splitTabsMap.set(tab.splitViewId, []);
            }
            splitTabsMap.get(tab.splitViewId).push(tab);
        }
    }

    // Helper to get or create tab element
    const getOrCreateTabElement = (tab) => {
        let tabElement = tabElementsCache.get(tab.id);
        if (tabElement) {
            updateTabElement(tabElement, tab);
        } else {
            tabElement = createTabElement(tab, { onAddToGroupClick });
        }
        newTabElementsCache.set(tab.id, tabElement);
        return tabElement;
    };

    // Helper to render split groups
    const renderSplitOrTab = (tab, container) => {
        if (renderedTabIds.has(tab.id)) return;

        if (tab.splitViewId && tab.splitViewId > 0) {
            // Find all tabs in the same split view context
            const splitTabs = splitTabsMap.get(tab.splitViewId);

            if (splitTabs && splitTabs.length > 1) {
                const splitGroup = document.createElement('div');
                splitGroup.className = 'tab-split-group';

                splitTabs.forEach(splitTab => {
                    const tabElement = getOrCreateTabElement(splitTab);
                    tabElement.classList.add('in-split-view');
                    splitGroup.appendChild(tabElement);
                    renderedTabIds.add(splitTab.id);
                });
                container.appendChild(splitGroup);
                return;
            }
        }

        // Fallback to normal rendering if not split view or only 1 tab in split
        const tabElement = getOrCreateTabElement(tab);
        tabElement.classList.remove('in-split-view'); // Ensure it's clean if it was in split before
        container.appendChild(tabElement);
        renderedTabIds.add(tab.id);
    };

    for (const tab of tabs) {
        if (renderedTabIds.has(tab.id)) {
            continue;
        }

        if (tab.groupId > 0) {
            const group = groupsMap.get(tab.groupId);
            if (!group) continue;

            let groupHeader = groupHeaderElementsCache.get(group.id);
            if (groupHeader) {
                updateGroupHeaderElement(groupHeader, group);
            } else {
                groupHeader = document.createElement('div');
                groupHeader.className = 'tab-group-header';
                groupHeader.tabIndex = 0;
                groupHeader.setAttribute('role', 'button');

                const arrow = document.createElement('span');
                arrow.className = 'tab-group-arrow';

                const colorDot = document.createElement('div');
                colorDot.className = 'tab-group-color-dot';

                const title = document.createElement('span');
                title.className = 'tab-group-title';

                groupHeader.appendChild(arrow);
                groupHeader.appendChild(colorDot);
                groupHeader.appendChild(title);

                updateGroupHeaderElement(groupHeader, group);
            }

            groupHeader.dataset.groupId = group.id; // Ensure ID is set
            newGroupHeaderElementsCache.set(group.id, groupHeader);
            fragment.appendChild(groupHeader);

            // Get or create groupContent container
            let groupContent = groupContentElementsCache.get(group.id);
            if (groupContent) {
                // Reuse existing container - clear its children
                groupContent.innerHTML = '';
            } else {
                groupContent = document.createElement('div');
                groupContent.className = 'tab-group-content';
            }
            groupContent.style.display = group.collapsed ? 'none' : 'block';
            newGroupContentElementsCache.set(group.id, groupContent);

            // Optimization: Use pre-grouped tabs
            const tabsInThisGroup = tabsByGroup.get(group.id) || [];

            for (const groupTab of tabsInThisGroup) {
                renderSplitOrTab(groupTab, groupContent);
            }
            fragment.appendChild(groupContent);

        } else {
            renderSplitOrTab(tab, fragment);
        }
    }

    // Clear the container to remove any elements that were not reused (deleted tabs)
    tabListContainer.innerHTML = '';
    tabListContainer.appendChild(fragment);

    // Update caches
    tabElementsCache = newTabElementsCache;
    groupHeaderElementsCache = newGroupHeaderElementsCache;
    groupContentElementsCache = newGroupContentElementsCache;
}
