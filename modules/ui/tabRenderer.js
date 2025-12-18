import * as api from '../apiManager.js';
import { tabListContainer, otherWindowsList } from './elements.js';

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
    }
    tabItem.dataset.tabId = tab.id;
    tabItem.dataset.url = tab.url;

    let urlPreview = tab.url;
    if (urlPreview && urlPreview.length > 300) {
        urlPreview = urlPreview.substring(0, 300) + '...';
    }
    tabItem.title = `${tab.title}\n${urlPreview}`;
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
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
    closeBtn.title = api.getMessage("closeTab") || "Close Tab";
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.removeTab(tab.id);
    });

    const addToGroupBtn = document.createElement('button');
    addToGroupBtn.className = 'add-to-group-btn';
    addToGroupBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>`;
    addToGroupBtn.title = api.getMessage("addToGroup") || "Add tab to new group";
    addToGroupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAddToGroupClick(tab.id);
    });

    const addToBookmarkBtn = document.createElement('button');
    addToBookmarkBtn.className = 'add-to-bookmark-btn';
    addToBookmarkBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
    addToBookmarkBtn.title = api.getMessage("addBookmark") || "Add to bookmarks";
    addToBookmarkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        // Note: Circular dependency if we import modalManager directly here if modalManager imports uiManager.
        // But modalManager likely doesn't import uiManager.
        // However, tabRenderer needs modalManager.
        // Let's assume modalManager is safe to import.
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
    tabItem.appendChild(titleWrapper);  // 使用 titleWrapper 而不是直接 title
    tabItem.appendChild(actionsContainer);
    tabItem.addEventListener('click', () => {
        api.updateTab(tab.id, { active: true });
        api.updateWindow(tab.windowId, { focused: true });
    });

    // Custom Context Menu
    tabItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Remove existing context menus
        const existingMenu = document.querySelector('.custom-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'custom-context-menu';

        // Position logic to prevent overflow
        let x = e.clientX;
        let y = e.clientY;

        // Adjust if close to right edge
        if (x + 150 > window.innerWidth) {
            x = window.innerWidth - 160;
        }

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Copy URL Option
        const copyOption = document.createElement('div');
        copyOption.className = 'context-menu-item';
        copyOption.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>${api.getMessage('copyUrl')}</span>
        `;

        copyOption.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(tab.url);

                // Show feedback
                const originalText = copyOption.querySelector('span').textContent;
                copyOption.querySelector('span').textContent = api.getMessage('urlCopied');
                copyOption.style.color = 'var(--accent-color)';

                setTimeout(() => {
                    menu.remove();
                }, 800);
            } catch (err) {
                console.error('Failed to copy: ', err);
                menu.remove();
            }
        });

        menu.appendChild(copyOption);
        document.body.appendChild(menu);

        // Close menu when clicking outside
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('contextmenu', closeMenu); // Also close on right click elsewhere
        };

        // Use setTimeout to avoid immediate trigger
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            document.addEventListener('contextmenu', (e) => {
                if (!menu.contains(e.target)) {
                    closeMenu();
                }
            });
        }, 0);
    });

    return tabItem;
}

export function renderTabsAndGroups(tabs, groups, { onAddToGroupClick }) {
    tabListContainer.innerHTML = '';
    const groupsMap = new Map(groups.map(group => [group.id, group]));
    const renderedTabIds = new Set();

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
                    // Ensure we don't duplicate if something weird happens, though renderedTabIds check at top handles main loop
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
            tabListContainer.appendChild(groupHeader);

            const groupContent = document.createElement('div');
            groupContent.className = 'tab-group-content';
            groupContent.style.display = group.collapsed ? 'none' : 'block';

            const tabsInThisGroup = tabs.filter(t => t.groupId === group.id);
            for (const groupTab of tabsInThisGroup) {
                renderSplitOrTab(groupTab, tabsInThisGroup, groupContent);
            }
            tabListContainer.appendChild(groupContent);

            groupHeader.addEventListener('click', (e) => {
                if (e.target.tagName === 'SPAN' || e.target.tagName === 'DIV') {
                    const isCollapsed = groupContent.style.display === 'none';
                    groupContent.style.display = isCollapsed ? 'block' : 'none';
                    arrow.textContent = isCollapsed ? '▼' : '▶';
                    api.updateTabGroup(group.id, { collapsed: !isCollapsed });
                }
            });
        } else {
            renderSplitOrTab(tab, tabs, tabListContainer);
        }
    }
}

// Create a simple tab element for other windows (without group actions)
function createOtherWindowTabElement(tab) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    tabItem.dataset.tabId = tab.id;
    tabItem.dataset.url = tab.url;

    let urlPreview = tab.url;
    if (urlPreview && urlPreview.length > 300) {
        urlPreview = urlPreview.substring(0, 300) + '...';
    }
    tabItem.title = `${tab.title}\n${urlPreview}`;

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
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

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'tab-content-wrapper';
    titleWrapper.appendChild(title);

    tabItem.appendChild(favicon);
    tabItem.appendChild(titleWrapper);

    // Click to focus the tab and its window
    tabItem.addEventListener('click', () => {
        api.updateTab(tab.id, { active: true });
        api.updateWindow(tab.windowId, { focused: true });
    });

    return tabItem;
}

export function renderOtherWindowsSection(otherWindows, currentWindowId, allGroups = []) {
    if (!otherWindowsList) return;

    // Filter out current window and windows with no tabs
    const windowsToShow = otherWindows.filter(w => w.id !== currentWindowId && w.tabs && w.tabs.length > 0);

    otherWindowsList.innerHTML = '';

    if (windowsToShow.length === 0) return;

    windowsToShow.forEach((window, index) => {
        // Use bookmark-folder style
        const folderItem = document.createElement('div');
        folderItem.className = 'bookmark-folder';
        folderItem.dataset.windowId = window.id;
        folderItem.title = `Window ${index + 1}`;

        const icon = document.createElement('span');
        icon.className = 'bookmark-icon';
        icon.textContent = '▶';

        const title = document.createElement('span');
        title.className = 'bookmark-title';
        title.textContent = `Window ${index + 1} (${window.tabs.length})`;

        folderItem.appendChild(icon);
        folderItem.appendChild(title);

        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';
        folderContent.style.display = 'none';

        // Get groups for this window
        const windowGroups = allGroups.filter(g => g.windowId === window.id);
        const groupsMap = new Map(windowGroups.map(group => [group.id, group]));
        const renderedTabIds = new Set();

        // Render tabs with group support
        for (const tab of window.tabs) {
            if (renderedTabIds.has(tab.id)) continue;

            if (tab.groupId > 0) {
                const group = groupsMap.get(tab.groupId);
                if (!group) continue;

                const groupHeader = document.createElement('div');
                groupHeader.className = 'tab-group-header';
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

                const groupTitle = document.createElement('span');
                groupTitle.className = 'tab-group-title';
                groupTitle.textContent = group.title;

                groupHeader.style.backgroundColor = hexToRgba(groupColorHex, 0.2);
                groupHeader.addEventListener('mouseenter', () => {
                    groupHeader.style.backgroundColor = hexToRgba(groupColorHex, 0.35);
                });
                groupHeader.addEventListener('mouseleave', () => {
                    groupHeader.style.backgroundColor = hexToRgba(groupColorHex, 0.2);
                });

                groupHeader.appendChild(arrow);
                groupHeader.appendChild(colorDot);
                groupHeader.appendChild(groupTitle);
                folderContent.appendChild(groupHeader);

                const groupContent = document.createElement('div');
                groupContent.className = 'tab-group-content';
                groupContent.style.display = group.collapsed ? 'none' : 'block';

                const tabsInThisGroup = window.tabs.filter(t => t.groupId === group.id);
                for (const groupTab of tabsInThisGroup) {
                    if (renderedTabIds.has(groupTab.id)) continue;
                    const tabElement = createOtherWindowTabElement(groupTab);
                    groupContent.appendChild(tabElement);
                    renderedTabIds.add(groupTab.id);
                }
                folderContent.appendChild(groupContent);

                groupHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isCollapsed = groupContent.style.display === 'none';
                    groupContent.style.display = isCollapsed ? 'block' : 'none';
                    arrow.textContent = isCollapsed ? '▼' : '▶';
                });
            } else {
                const tabElement = createOtherWindowTabElement(tab);
                folderContent.appendChild(tabElement);
                renderedTabIds.add(tab.id);
            }
        }

        // Toggle collapse on click
        folderItem.addEventListener('click', () => {
            const isExpanded = folderContent.style.display !== 'none';
            folderContent.style.display = isExpanded ? 'none' : 'block';
            icon.textContent = isExpanded ? '▶' : '▼';
        });

        otherWindowsList.appendChild(folderItem);
        otherWindowsList.appendChild(folderContent);
    });
}
