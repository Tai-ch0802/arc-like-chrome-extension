import * as api from '../apiManager.js';
import { ADD_TO_GROUP_ICON_SVG, BOOKMARK_ICON_SVG } from '../icons.js';
import { tabListContainer } from './elements.js';
import { showContextMenu } from './contextMenuManager.js';
import { GROUP_COLORS, hexToRgba } from './groupColors.js';

let tabsCache = new Map();
let tabCallbacks = {};

export function initializeTabListeners(callbacks) {
    tabCallbacks = callbacks;

    // Delegated Click Listener
    tabListContainer.addEventListener('click', async (e) => {
        const target = e.target;

        // 1. Close Button
        const closeBtn = target.closest('.close-btn');
        if (closeBtn) {
            e.stopPropagation();
            const tabItem = closeBtn.closest('.tab-item');
            if (tabItem) {
                const tabId = parseInt(tabItem.dataset.tabId, 10);
                api.removeTab(tabId);
            }
            return;
        }

        // 2. Add to Group Button
        const addToGroupBtn = target.closest('.add-to-group-btn');
        if (addToGroupBtn) {
            e.stopPropagation();
            const tabItem = addToGroupBtn.closest('.tab-item');
            if (tabItem && tabCallbacks.onAddToGroupClick) {
                const tabId = parseInt(tabItem.dataset.tabId, 10);
                tabCallbacks.onAddToGroupClick(tabId);
            }
            return;
        }

        // 3. Add to Bookmark Button
        const addToBookmarkBtn = target.closest('.add-to-bookmark-btn');
        if (addToBookmarkBtn) {
            e.stopPropagation();
            const tabItem = addToBookmarkBtn.closest('.tab-item');
            if (tabItem) {
                const tabId = parseInt(tabItem.dataset.tabId, 10);
                const tab = tabsCache.get(tabId);
                if (tab) {
                    const modal = await import('../modalManager.js');
                    const result = await modal.showAddToBookmarkDialog({
                        name: tab.title,
                        url: tab.url
                    });
                    if (result) {
                        await api.createBookmark(result);
                    }
                }
            }
            return;
        }

        // 4. Group Header Toggle
        const groupHeader = target.closest('.tab-group-header');
        if (groupHeader) {
            const groupId = parseInt(groupHeader.dataset.groupId, 10);
            const content = groupHeader.nextElementSibling;
            const arrow = groupHeader.querySelector('.tab-group-arrow');

            if (content && content.classList.contains('tab-group-content')) {
                const isCollapsed = content.style.display === 'none';
                // Toggle state
                const newCollapsedState = !isCollapsed;
                content.style.display = isCollapsed ? 'block' : 'none';
                if (arrow) arrow.textContent = isCollapsed ? '▼' : '▶';
                groupHeader.setAttribute('aria-expanded', isCollapsed.toString());

                // Update via API
                api.updateTabGroup(groupId, { collapsed: newCollapsedState });
            }
            return;
        }

        // 5. Tab Activation (Tab Item)
        const tabItem = target.closest('.tab-item');
        if (tabItem) {
            // Ignore if we clicked inside actions container but missed buttons
             if (target.closest('.tab-actions')) return;

            const tabId = parseInt(tabItem.dataset.tabId, 10);
            const tab = tabsCache.get(tabId);
            if (tab) {
                api.updateTab(tab.id, { active: true });
                api.updateWindow(tab.windowId, { focused: true });
            }
            return;
        }
    });

    // Delegated Keydown Listener
    tabListContainer.addEventListener('keydown', (e) => {
        const target = e.target;

        // Tab Item Keydown
        if (target.classList.contains('tab-item')) {
            const tabId = parseInt(target.dataset.tabId, 10);
            const tab = tabsCache.get(tabId);

            if (e.key === 'Enter') {
                e.preventDefault();
                 if (tab) {
                    api.updateTab(tab.id, { active: true });
                    api.updateWindow(tab.windowId, { focused: true });
                }
            } else if (e.key === 'Delete') {
                e.preventDefault();
                e.stopPropagation();
                api.removeTab(tabId);
            } else if (e.key === ' ') {
                e.preventDefault();
                // Context Menu
                const existingMenu = document.querySelector('.custom-context-menu');
                if (existingMenu) {
                    existingMenu.remove();
                } else if (tab) {
                    const rect = target.getBoundingClientRect();
                    showContextMenu(rect.left + 20, rect.bottom, tab, target);
                }
            }
        }
        // Group Header Keydown
        else if (target.classList.contains('tab-group-header')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                target.click(); // Trigger the click handler
            }
        }
    });

    // Delegated Context Menu Listener
    tabListContainer.addEventListener('contextmenu', (e) => {
        const tabItem = e.target.closest('.tab-item');
        if (tabItem) {
            e.preventDefault();
            const tabId = parseInt(tabItem.dataset.tabId, 10);
            const tab = tabsCache.get(tabId);
            if (tab) {
                 showContextMenu(e.clientX, e.clientY, tab, tabItem);
            }
        }
    });
}


export function createTabElement(tab) {
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

    // Scroll focused item into view for keyboard navigation
    tabItem.addEventListener('focus', () => {
        tabItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

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
    const closeTabLabel = api.getMessage("closeTab") || "Close Tab";
    closeBtn.title = closeTabLabel;
    closeBtn.setAttribute('aria-label', closeTabLabel);
    closeBtn.dataset.action = 'close';

    const addToGroupBtn = document.createElement('button');
    addToGroupBtn.className = 'add-to-group-btn';
    addToGroupBtn.innerHTML = ADD_TO_GROUP_ICON_SVG;
    addToGroupBtn.tabIndex = -1;
    const addToGroupLabel = api.getMessage("addToGroup") || "Add tab to new group";
    addToGroupBtn.title = addToGroupLabel;
    addToGroupBtn.setAttribute('aria-label', addToGroupLabel);
    addToGroupBtn.dataset.action = 'add-group';

    const addToBookmarkBtn = document.createElement('button');
    addToBookmarkBtn.className = 'add-to-bookmark-btn';
    addToBookmarkBtn.innerHTML = BOOKMARK_ICON_SVG;
    addToBookmarkBtn.tabIndex = -1;
    const addToBookmarkLabel = api.getMessage("addBookmark") || "Add to bookmarks";
    addToBookmarkBtn.title = addToBookmarkLabel;
    addToBookmarkBtn.setAttribute('aria-label', addToBookmarkLabel);
    addToBookmarkBtn.dataset.action = 'bookmark';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'tab-actions';
    actionsContainer.appendChild(addToGroupBtn);
    actionsContainer.appendChild(addToBookmarkBtn);
    actionsContainer.appendChild(closeBtn);

    tabItem.appendChild(favicon);
    tabItem.appendChild(titleWrapper);
    tabItem.appendChild(actionsContainer);

    // Note: Event listeners are now handled via delegation in initializeTabListeners

    return tabItem;
}

export function renderTabsAndGroups(tabs, groups) {
    // Clear previous cache
    tabsCache.clear();

    tabListContainer.innerHTML = '';
    const groupsMap = new Map(groups.map(group => [group.id, group]));

    // Optimization: Pre-group tabs by groupId
    const tabsByGroup = new Map();
    for (const tab of tabs) {
        // Cache tab for delegated events
        tabsCache.set(tab.id, tab);

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
                    const tabElement = createTabElement(splitTab);
                    tabElement.classList.add('in-split-view');
                    splitGroup.appendChild(tabElement);
                    renderedTabIds.add(splitTab.id);
                });
                container.appendChild(splitGroup);
                return;
            }
        }

        // Fallback to normal rendering if not split view or only 1 tab in split
        const tabElement = createTabElement(tab);
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

            const groupHeader = document.createElement('div');
            groupHeader.className = 'tab-group-header';
            groupHeader.tabIndex = 0;
            groupHeader.setAttribute('role', 'button');
            groupHeader.setAttribute('aria-expanded', (!group.collapsed).toString());
            groupHeader.dataset.collapsed = group.collapsed;
            groupHeader.dataset.groupId = group.id;
            groupHeader.title = group.title;

            const arrow = document.createElement('span');
            arrow.className = 'tab-group-arrow';
            arrow.textContent = group.collapsed ? '▶' : '▼';

            const colorDot = document.createElement('div');
            colorDot.className = 'tab-group-color-dot';
            const groupColorHex = GROUP_COLORS[group.color] || '#5f6368';
            colorDot.style.backgroundColor = groupColorHex;

            const title = document.createElement('span');
            title.className = 'tab-group-title';
            title.textContent = group.title;

            groupHeader.style.backgroundColor = hexToRgba(groupColorHex, 0.2);
            groupHeader.addEventListener('mouseenter', () => {
                groupHeader.style.backgroundColor = hexToRgba(groupColorHex, 0.35);
            });
            groupHeader.addEventListener('mouseleave', () => {
                groupHeader.style.backgroundColor = hexToRgba(groupColorHex, 0.2);
            });

            groupHeader.appendChild(arrow);
            groupHeader.appendChild(colorDot);
            groupHeader.appendChild(title);
            fragment.appendChild(groupHeader);

            const groupContent = document.createElement('div');
            groupContent.className = 'tab-group-content';
            groupContent.style.display = group.collapsed ? 'none' : 'block';

            // Optimization: Use pre-grouped tabs
            const tabsInThisGroup = tabsByGroup.get(group.id) || [];

            for (const groupTab of tabsInThisGroup) {
                renderSplitOrTab(groupTab, groupContent);
            }
            fragment.appendChild(groupContent);

            // Note: Event listeners for header click/keydown are now handled via delegation
        } else {
            renderSplitOrTab(tab, fragment);
        }
    }
    tabListContainer.appendChild(fragment);
}
