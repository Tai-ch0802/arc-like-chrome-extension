import * as api from '../apiManager.js';
import { ADD_TO_GROUP_ICON_SVG, BOOKMARK_ICON_SVG } from '../icons.js';
import { tabListContainer } from './elements.js';
import { showContextMenu } from './contextMenuManager.js';

const GROUP_COLORS = {
    grey: '#5f6368',
    blue: '#8ab4f8',
    red: '#f28b82',
    yellow: '#fdd663',
    green: '#81c995',
    pink: '#ff8bcb',
    purple: '#c58af9',
    cyan: '#78d9ec',
    orange: '#ffab70'
};

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.removeTab(tab.id);
    });

    const addToGroupBtn = document.createElement('button');
    addToGroupBtn.className = 'add-to-group-btn';
    addToGroupBtn.innerHTML = ADD_TO_GROUP_ICON_SVG;
    addToGroupBtn.tabIndex = -1;
    const addToGroupLabel = api.getMessage("addToGroup") || "Add tab to new group";
    addToGroupBtn.title = addToGroupLabel;
    addToGroupBtn.setAttribute('aria-label', addToGroupLabel);
    addToGroupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAddToGroupClick(tab.id);
    });

    const addToBookmarkBtn = document.createElement('button');
    addToBookmarkBtn.className = 'add-to-bookmark-btn';
    addToBookmarkBtn.innerHTML = BOOKMARK_ICON_SVG;
    addToBookmarkBtn.tabIndex = -1;
    const addToBookmarkLabel = api.getMessage("addBookmark") || "Add to bookmarks";
    addToBookmarkBtn.title = addToBookmarkLabel;
    addToBookmarkBtn.setAttribute('aria-label', addToBookmarkLabel);
    addToBookmarkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const modal = await import('../modalManager.js');
        const result = await modal.showAddToBookmarkDialog({
            name: tab.title,
            url: tab.url
        });
        if (result) {
            await api.createBookmark(result);
        }
    });

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'tab-actions';
    actionsContainer.appendChild(addToGroupBtn);
    actionsContainer.appendChild(addToBookmarkBtn);
    actionsContainer.appendChild(closeBtn);

    tabItem.appendChild(favicon);
    tabItem.appendChild(titleWrapper);
    tabItem.appendChild(actionsContainer);

    const activateTab = () => {
        api.updateTab(tab.id, { active: true });
        api.updateWindow(tab.windowId, { focused: true });
    };

    tabItem.addEventListener('click', activateTab);
    tabItem.addEventListener('keydown', (e) => {
        if (e.target !== e.currentTarget) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            activateTab();
        } else if (e.key === 'Delete') {
            e.preventDefault();
            e.stopPropagation();
            closeBtn.click();
        } else if (e.key === ' ') {
            e.preventDefault();
            // Toggle context menu via keyboard
            const existingMenu = document.querySelector('.custom-context-menu');
            if (existingMenu) {
                existingMenu.remove();
            } else {
                const rect = tabItem.getBoundingClientRect();
                showContextMenu(rect.left + 20, rect.bottom, tab, tabItem);
            }
        }
    });

    // Custom Context Menu (mouse right-click)
    tabItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, tab, tabItem);
    });

    return tabItem;
}

export function renderTabsAndGroups(tabs, groups, { onAddToGroupClick }) {
    tabListContainer.innerHTML = '';
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

    // Helper to render split groups
    const renderSplitOrTab = (tab, contextTabs, container) => {
        if (renderedTabIds.has(tab.id)) return;

        if (tab.splitViewId && tab.splitViewId > 0) {
            // Find all tabs in the same split view context
            const splitTabs = contextTabs.filter(t => t.splitViewId === tab.splitViewId);

            if (splitTabs.length > 1) {
                const splitGroup = document.createElement('div');
                splitGroup.className = 'tab-split-group';

                splitTabs.forEach(splitTab => {
                    const tabElement = createTabElement(splitTab, { onAddToGroupClick });
                    tabElement.classList.add('in-split-view');
                    splitGroup.appendChild(tabElement);
                    renderedTabIds.add(splitTab.id);
                });
                container.appendChild(splitGroup);
                return;
            }
        }

        // Fallback to normal rendering if not split view or only 1 tab in split
        const tabElement = createTabElement(tab, { onAddToGroupClick });
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
                renderSplitOrTab(groupTab, tabsInThisGroup, groupContent);
            }
            fragment.appendChild(groupContent);

            groupHeader.addEventListener('click', (e) => {
                if (e.target.tagName === 'SPAN' || e.target.tagName === 'DIV') {
                    const isCollapsed = groupContent.style.display === 'none';
                    const newCollapsedState = !isCollapsed;
                    groupContent.style.display = isCollapsed ? 'block' : 'none';
                    arrow.textContent = isCollapsed ? '▼' : '▶';
                    groupHeader.setAttribute('aria-expanded', isCollapsed.toString());
                    api.updateTabGroup(group.id, { collapsed: newCollapsedState });
                }
            });

            groupHeader.addEventListener('keydown', (e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    groupHeader.click();
                }
            });
        } else {
            renderSplitOrTab(tab, tabs, fragment);
        }
    }
    tabListContainer.appendChild(fragment);
}
