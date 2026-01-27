/**
 * Other Window Renderer Module
 * Handles rendering of tabs from windows other than the current window.
 */
import * as api from '../apiManager.js';
import * as state from '../stateManager.js';
import { EDIT_ICON_SVG } from '../icons.js';
import { otherWindowsList } from './elements.js';
import { GROUP_COLORS, hexToRgba } from './groupColors.js';

/** @type {Map<number, chrome.tabs.Tab>} Cache of tab objects for other windows */
let otherTabsCache = new Map();

/**
 * Returns the current cache of tab objects for other windows.
 * @returns {Map<number, chrome.tabs.Tab>}
 */
export function getOtherTabCache() {
    return otherTabsCache;
}


/**
 * Create a simple tab element for other windows (without group actions)
 * @param {Object} tab - Chrome tab object
 * @returns {HTMLElement}
 */
function createOtherWindowTabElement(tab) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    tabItem.setAttribute('role', 'button');
    tabItem.tabIndex = 0;
    tabItem.dataset.tabId = tab.id;
    tabItem.dataset.url = tab.url;
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

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'tab-content-wrapper';
    titleWrapper.appendChild(title);

    tabItem.appendChild(favicon);
    tabItem.appendChild(titleWrapper);

    // Click to focus the tab and its window
    const activateTab = () => {
        api.updateTab(tab.id, { active: true });
        api.updateWindow(tab.windowId, { focused: true });
    };

    tabItem.addEventListener('click', activateTab);
    tabItem.addEventListener('keydown', (e) => {
        if (e.target !== e.currentTarget) return;

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activateTab();
        }
    });

    return tabItem;
}

/**
 * Renders the "Other Windows" section in the sidebar.
 * @param {Array} otherWindows - Array of window objects with tabs
 * @param {number} currentWindowId - ID of the current window
 * @param {Array} allGroups - Array of all tab groups across all windows
 */
export function renderOtherWindowsSection(otherWindows, currentWindowId, allGroups = []) {
    if (!otherWindowsList) return;

    // Filter out current window and windows with no tabs
    const windowsToShow = otherWindows.filter(w => w.id !== currentWindowId && w.tabs && w.tabs.length > 0);

    otherWindowsList.innerHTML = '';

    if (windowsToShow.length === 0) return;

    // Optimization: Pre-group all groups by windowId
    const groupsByWindow = new Map();
    for (const g of allGroups) {
        if (!groupsByWindow.has(g.windowId)) {
            groupsByWindow.set(g.windowId, []);
        }
        groupsByWindow.get(g.windowId).push(g);
    }

    // Reset and rebuild cache
    otherTabsCache.clear();
    windowsToShow.forEach(window => {
        window.tabs.forEach(tab => {
            otherTabsCache.set(tab.id, tab);
        });
    });

    // Use DocumentFragment to batch DOM updates
    const fragment = document.createDocumentFragment();

    windowsToShow.forEach((window, index) => {
        // Use bookmark-folder style
        const folderItem = document.createElement('div');
        folderItem.className = 'window-folder';
        folderItem.tabIndex = 0;
        folderItem.setAttribute('role', 'button');
        folderItem.setAttribute('aria-expanded', 'false');
        folderItem.dataset.windowId = window.id;
        folderItem.title = `Window ${index + 1}`;

        const icon = document.createElement('span');
        icon.className = 'window-icon';
        icon.textContent = '▶';

        const customName = state.getWindowName(window.id);
        const titleText = customName || `Window ${index + 1} (${window.tabs.length})`;

        const title = document.createElement('span');
        title.className = 'window-title';
        title.textContent = titleText;
        title.style.flex = '1';

        const editBtn = document.createElement('button');
        editBtn.className = 'window-edit-btn';
        editBtn.innerHTML = EDIT_ICON_SVG;
        editBtn.style.marginLeft = '4px';
        editBtn.tabIndex = -1;
        const renameWindowLabel = api.getMessage('renameWindow') || 'Rename Window';
        editBtn.title = renameWindowLabel;
        editBtn.setAttribute('aria-label', renameWindowLabel);

        editBtn.onclick = async (e) => {
            e.stopPropagation();
            const modal = await import('../modalManager.js');
            const newName = await modal.showPrompt({
                title: api.getMessage('renameWindowDialogTitle') || 'Rename Window',
                confirmButtonText: api.getMessage('saveButton') || 'Save',
                defaultValue: customName || ''
            });

            if (newName !== null) {
                await state.setWindowName(window.id, newName);
                title.textContent = newName || `Window ${index + 1} (${window.tabs.length})`;
            }
        };

        editBtn.addEventListener('mouseenter', () => editBtn.style.opacity = '1');
        editBtn.addEventListener('mouseleave', () => editBtn.style.opacity = '0.6');

        folderItem.style.display = 'flex';
        folderItem.style.alignItems = 'center';

        folderItem.appendChild(icon);
        folderItem.appendChild(title);
        folderItem.appendChild(editBtn);

        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';
        folderContent.style.display = 'none';

        // Get groups for this window
        const windowGroups = groupsByWindow.get(window.id) || [];
        const groupsMap = new Map(windowGroups.map(group => [group.id, group]));

        // Optimization: Pre-group tabs for this window
        const tabsByGroup = new Map();
        for (const t of window.tabs) {
            if (t.groupId > 0) {
                if (!tabsByGroup.has(t.groupId)) {
                    tabsByGroup.set(t.groupId, []);
                }
                tabsByGroup.get(t.groupId).push(t);
            }
        }

        const renderedTabIds = new Set();

        // Render tabs with group support
        for (const tab of window.tabs) {
            if (renderedTabIds.has(tab.id)) continue;

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

                // Optimization: Use pre-grouped tabs
                const tabsInThisGroup = tabsByGroup.get(group.id) || [];

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
                    groupHeader.setAttribute('aria-expanded', isCollapsed.toString());
                });

                groupHeader.addEventListener('keydown', (e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        groupHeader.click();
                    }
                });
            } else {
                const tabElement = createOtherWindowTabElement(tab);
                folderContent.appendChild(tabElement);
                renderedTabIds.add(tab.id);
            }
        }

        // Toggle collapse on click
        const toggleCollapse = () => {
            const isExpanded = folderContent.style.display !== 'none';
            folderContent.style.display = isExpanded ? 'none' : 'block';
            icon.textContent = isExpanded ? '▶' : '▼';
            folderItem.setAttribute('aria-expanded', !isExpanded);
        };

        folderItem.addEventListener('click', toggleCollapse);
        folderItem.addEventListener('keydown', (e) => {
            if (e.target !== e.currentTarget) return;

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCollapse();
            }
        });

        fragment.appendChild(folderItem);
        fragment.appendChild(folderContent);
    });
    otherWindowsList.appendChild(fragment);
}
