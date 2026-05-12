/**
 * Other Window Renderer Module
 * Handles rendering of tabs from windows other than the current window.
 */
import * as api from '../apiManager.js';
import * as state from '../stateManager.js';
import { EDIT_ICON_SVG } from '../icons.js';
import { otherWindowsList } from './elements.js';
import { GROUP_COLORS, hexToRgba } from './groupColors.js';
import { reconcileDOM } from '../utils/domUtils.js';

/** @type {Map<number, chrome.tabs.Tab>} Cache of tab objects for other windows */
let otherTabsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of tab DOM elements for other windows */
let otherTabElementsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of group header DOM elements for other windows */
let otherGroupHeaderElementsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of group content DOM elements for other windows */
let otherGroupContentElementsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of window folder DOM elements */
let otherWindowFolderElementsCache = new Map();

/** @type {Map<number, HTMLElement>} Cache of window content DOM elements */
let otherWindowContentElementsCache = new Map();

/**
 * Returns the current cache of tab objects for other windows.
 * @returns {Map<number, chrome.tabs.Tab>}
 */
export function getOtherTabCache() {
    return otherTabsCache;
}

/**
 * Returns the current cache of tab DOM elements for other windows.
 * @returns {Map<number, HTMLElement>}
 */
export function getOtherTabElementsCache() {
    return otherTabElementsCache;
}

/**
 * Returns the current cache of group header DOM elements for other windows.
 * @returns {Map<number, HTMLElement>}
 */
export function getOtherGroupHeaderElementsCache() {
    return otherGroupHeaderElementsCache;
}

/**
 * Returns the current cache of window folder DOM elements.
 * @returns {Map<number, HTMLElement>}
 */
export function getOtherWindowFolderElementsCache() {
    return otherWindowFolderElementsCache;
}

/**
 * Resets the other window caches.
 * Useful for testing, hot-reload, or when the container element is replaced.
 * @returns {void}
 */
export function resetOtherWindowCaches() {
    otherTabsCache = new Map();
    otherTabElementsCache = new Map();
    otherGroupHeaderElementsCache = new Map();
    otherGroupContentElementsCache = new Map();
    otherWindowFolderElementsCache = new Map();
    otherWindowContentElementsCache = new Map();
}

function updateOtherWindowFolderElement(folderItem, folderContent, window, customName, tabCount) {
    const titleText = customName || `Window ${window.id} (${tabCount})`;
    if (folderItem.title !== `Window ${window.id}`) folderItem.title = `Window ${window.id}`;

    const titleSpan = folderItem.querySelector('.window-title');
    if (titleSpan && titleSpan.textContent !== titleText) {
        titleSpan.textContent = titleText;
    }
}

function updateOtherGroupHeaderElement(header, group) {
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

function updateOtherWindowTabElement(tabItem, tab) {
    if (tabItem.dataset.url !== tab.url) tabItem.dataset.url = tab.url;

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

function getOrCreateOtherWindowTabElement(tab, newOtherTabElementsCache) {
    let tabElement = otherTabElementsCache.get(tab.id);
    if (tabElement) {
        updateOtherWindowTabElement(tabElement, tab);
    } else {
        tabElement = createOtherWindowTabElement(tab);
    }
    newOtherTabElementsCache.set(tab.id, tabElement);
    return tabElement;
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

    // Cache DOM references
    tabItem._refs = {
        favicon,
        title,
        titleWrapper
    };

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

    if (windowsToShow.length === 0) {
        otherTabsCache.clear();
        otherTabElementsCache.clear();
        otherGroupHeaderElementsCache.clear();
        otherGroupContentElementsCache.clear();
        otherWindowFolderElementsCache.clear();
        otherWindowContentElementsCache.clear();
        reconcileDOM(otherWindowsList, []);
        return;
    }

    // Optimization: Pre-group all groups by windowId
    const groupsByWindow = new Map();
    for (const g of allGroups) {
        if (!groupsByWindow.has(g.windowId)) {
            groupsByWindow.set(g.windowId, []);
        }
        groupsByWindow.get(g.windowId).push(g);
    }

    const newOtherTabsCache = new Map();
    const newOtherTabElementsCache = new Map();
    const newOtherGroupHeaderElementsCache = new Map();
    const newOtherGroupContentElementsCache = new Map();
    const newOtherWindowFolderElementsCache = new Map();
    const newOtherWindowContentElementsCache = new Map();

    windowsToShow.forEach(window => {
        window.tabs.forEach(tab => {
            newOtherTabsCache.set(tab.id, tab);
        });
    });

    const topLevelChildren = [];

    windowsToShow.forEach((window, index) => {
        const customName = state.getWindowName(window.id);

        let folderItem = otherWindowFolderElementsCache.get(window.id);
        let folderContent = otherWindowContentElementsCache.get(window.id);

        if (!folderItem || !folderContent) {
            folderItem = document.createElement('div');
            folderItem.className = 'window-folder';
            folderItem.tabIndex = 0;
            folderItem.setAttribute('role', 'button');
            folderItem.setAttribute('aria-expanded', 'false');
            folderItem.dataset.windowId = window.id;
            folderItem.title = `Window ${window.id}`;

            const icon = document.createElement('span');
            icon.className = 'window-icon';
            icon.textContent = '▶';

            const titleText = customName || `Window ${window.id} (${window.tabs.length})`;

            const title = document.createElement('span');
            title.className = 'window-title';
            title.textContent = titleText;
            title.style.flex = '1';

            const editBtn = document.createElement('button');
            editBtn.className = 'window-edit-btn';

            // Fix SVG rendering per best practices
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(EDIT_ICON_SVG, "image/svg+xml");
            const svgNode = svgDoc.documentElement;
            editBtn.appendChild(svgNode);

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
                    title.textContent = newName || `Window ${window.id} (${window.tabs.length})`;
                }
            };

            editBtn.addEventListener('mouseenter', () => editBtn.style.opacity = '1');
            editBtn.addEventListener('mouseleave', () => editBtn.style.opacity = '0.6');

            folderItem.style.display = 'flex';
            folderItem.style.alignItems = 'center';

            folderItem.appendChild(icon);
            folderItem.appendChild(title);
            folderItem.appendChild(editBtn);

            folderContent = document.createElement('div');
            folderContent.className = 'folder-content';
            folderContent.style.display = 'none';

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
        } else {
            updateOtherWindowFolderElement(folderItem, folderContent, window, customName, window.tabs.length);
        }

        newOtherWindowFolderElementsCache.set(window.id, folderItem);
        newOtherWindowContentElementsCache.set(window.id, folderContent);

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

        const folderChildren = [];

        // Render tabs with group support
        for (const tab of window.tabs) {
            if (renderedTabIds.has(tab.id)) continue;

            if (tab.groupId > 0) {
                const group = groupsMap.get(tab.groupId);
                if (!group) continue;

                let groupHeader = otherGroupHeaderElementsCache.get(group.id);
                let groupContent = otherGroupContentElementsCache.get(group.id);

                if (!groupHeader || !groupContent) {
                    groupHeader = document.createElement('div');
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

                    groupContent = document.createElement('div');
                    groupContent.className = 'tab-group-content';
                    groupContent.style.display = group.collapsed ? 'none' : 'block';

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
                    updateOtherGroupHeaderElement(groupHeader, group);
                }

                newOtherGroupHeaderElementsCache.set(group.id, groupHeader);
                newOtherGroupContentElementsCache.set(group.id, groupContent);

                folderChildren.push(groupHeader);
                folderChildren.push(groupContent);

                // Optimization: Use pre-grouped tabs
                const tabsInThisGroup = tabsByGroup.get(group.id) || [];
                const groupChildren = [];

                for (const groupTab of tabsInThisGroup) {
                    if (renderedTabIds.has(groupTab.id)) continue;
                    const tabElement = getOrCreateOtherWindowTabElement(groupTab, newOtherTabElementsCache);
                    groupChildren.push(tabElement);
                    renderedTabIds.add(groupTab.id);
                }
                reconcileDOM(groupContent, groupChildren);
            } else {
                const tabElement = getOrCreateOtherWindowTabElement(tab, newOtherTabElementsCache);
                folderChildren.push(tabElement);
                renderedTabIds.add(tab.id);
            }
        }
        reconcileDOM(folderContent, folderChildren);

        topLevelChildren.push(folderItem);
        topLevelChildren.push(folderContent);
    });

    reconcileDOM(otherWindowsList, topLevelChildren);

    // Swap caches
    otherTabsCache = newOtherTabsCache;
    otherTabElementsCache = newOtherTabElementsCache;
    otherGroupHeaderElementsCache = newOtherGroupHeaderElementsCache;
    otherGroupContentElementsCache = newOtherGroupContentElementsCache;
    otherWindowFolderElementsCache = newOtherWindowFolderElementsCache;
    otherWindowContentElementsCache = newOtherWindowContentElementsCache;
}
