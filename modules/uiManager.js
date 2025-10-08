import * as api from './apiManager.js';
import * as state from './stateManager.js';
import * as modal from './modalManager.js';

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

// --- DOM 元素獲取與導出 ---
export const tabListContainer = document.getElementById('tab-list');
export const bookmarkListContainer = document.getElementById('bookmark-list');
export const searchBox = document.getElementById('search-box');

// --- 渲染邏輯 ---
export function createTabElement(tab) {
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
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.title = api.getMessage("closeTab") || "Close Tab";
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.removeTab(tab.id);
    });

    const addToBookmarkBtn = document.createElement('button');
    addToBookmarkBtn.className = 'add-to-bookmark-btn';
    addToBookmarkBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
    addToBookmarkBtn.title = api.getMessage("addBookmark") || "Add to bookmarks";
    addToBookmarkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
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
    actionsContainer.appendChild(addToBookmarkBtn);
    actionsContainer.appendChild(closeBtn);

    tabItem.appendChild(favicon);
    tabItem.appendChild(title);
    tabItem.appendChild(actionsContainer);
    tabItem.addEventListener('click', () => {
        api.updateTab(tab.id, { active: true });
        api.updateWindow(tab.windowId, { focused: true });
    });
    return tabItem;
}

export function renderTabsAndGroups(tabs, groups) {
    tabListContainer.innerHTML = '';
    const groupsMap = new Map(groups.map(group => [group.id, group]));
    const renderedTabIds = new Set();

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
                const tabElement = createTabElement(groupTab);
                groupContent.appendChild(tabElement);
                renderedTabIds.add(groupTab.id);
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
            const tabElement = createTabElement(tab);
            tabListContainer.appendChild(tabElement);
            renderedTabIds.add(tab.id);
        }
    }
}

export function renderBookmarks(bookmarkNodes, container, parentId, refreshBookmarksCallback) {
    container.dataset.parentId = parentId;
    bookmarkNodes.forEach(node => {
        if (node.url) {
            const bookmarkItem = document.createElement('a');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.dataset.bookmarkId = node.id;
            bookmarkItem.href = node.url;
            bookmarkItem.target = '_blank';

            let urlPreview = node.url;
            if (urlPreview && urlPreview.length > 300) {
                urlPreview = urlPreview.substring(0, 300) + '...';
            }
            bookmarkItem.title = `${node.title}\n${urlPreview}`;

            const icon = document.createElement('img');
            icon.className = 'bookmark-icon';
            if (node.url && (node.url.startsWith('http') || node.url.startsWith('https'))) {
                try {
                    const domain = new URL(node.url).hostname;
                    icon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${domain}`;
                } catch (error) {
                    icon.src = 'icons/fallback-favicon.svg';
                }
            } else {
                icon.src = 'icons/fallback-favicon.svg';
            }

            icon.onerror = () => {
                icon.src = 'icons/fallback-favicon.svg';
            };
            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = node.title;

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'bookmark-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'bookmark-edit-btn';
            editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
            editBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const result = await modal.showFormDialog({
                    title: api.getMessage("editBookmarkPromptForTitle"),
                    fields: [
                        { name: 'title', label: 'Name', defaultValue: node.title },
                        { name: 'url', label: 'URL', defaultValue: node.url }
                    ],
                    confirmButtonText: api.getMessage("saveButton")
                });

                if (result && (result.title !== node.title || result.url !== node.url)) {
                    api.updateBookmark(node.id, { title: result.title, url: result.url }).then(refreshBookmarksCallback);
                }
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'bookmark-close-btn';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const confirm = await modal.showConfirm({
                    title: api.getMessage("deleteBookmarkConfirm", node.title),
                    confirmButtonText: api.getMessage("deleteButton"),
                    confirmButtonClass: 'danger'
                });
                if (confirm) {
                    api.removeBookmark(node.id).then(refreshBookmarksCallback);
                }
            });

            actionsContainer.appendChild(editBtn);
            actionsContainer.appendChild(closeBtn);
            bookmarkItem.appendChild(icon);
            bookmarkItem.appendChild(title);
            bookmarkItem.appendChild(actionsContainer);

            bookmarkItem.addEventListener('click', (e) => {
                if (e.target !== closeBtn) {
                    e.preventDefault();
                    api.createTab({ url: node.url });
                }
            });
            container.appendChild(bookmarkItem);

        } else if (node.children) {
            const folderItem = document.createElement('div');
            folderItem.className = 'bookmark-folder';
            folderItem.dataset.bookmarkId = node.id;
            folderItem.title = node.title;

            const isExpanded = state.isFolderExpanded(node.id);
            const icon = document.createElement('span');
            icon.className = 'bookmark-icon';
            icon.textContent = isExpanded ? '▼' : '▶';
            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = node.title;

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'bookmark-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'bookmark-edit-btn';
            editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newTitle = await modal.showPrompt({
                    title: api.getMessage("editBookmarkFolderPromptForTitle"),
                    defaultValue: node.title,
                    confirmButtonText: api.getMessage("saveButton")
                });
                if (newTitle && newTitle !== node.title) {
                    api.updateBookmark(node.id, { title: newTitle }).then(refreshBookmarksCallback);
                }
            });

            const addFolderBtn = document.createElement('button');
            addFolderBtn.className = 'add-folder-btn';
            addFolderBtn.textContent = '+';
            addFolderBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newFolderName = await modal.showPrompt({
                    title: api.getMessage("addFolderPrompt", node.title),
                    confirmButtonText: api.getMessage("createButton")
                });
                if (newFolderName) {
                    api.createBookmark({ parentId: node.id, title: newFolderName }).then(() => {
                        state.addExpandedFolder(node.id);
                        refreshBookmarksCallback();
                    });
                }
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'bookmark-close-btn';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirm = await modal.showConfirm({
                    title: api.getMessage("deleteFolderConfirm", node.title),
                    confirmButtonText: api.getMessage("deleteButton"),
                    confirmButtonClass: 'danger'
                });
                if (confirm) {
                    api.removeBookmarkTree(node.id).then(() => {
                        state.removeExpandedFolder(node.id);
                        refreshBookmarksCallback();
                    });
                }
            });

            actionsContainer.appendChild(editBtn);
            if (!node.url) {
                actionsContainer.appendChild(addFolderBtn);
            }
            actionsContainer.appendChild(closeBtn);

            folderItem.appendChild(icon);
            folderItem.appendChild(title);
            folderItem.appendChild(actionsContainer);
            container.appendChild(folderItem);

            const folderContent = document.createElement('div');
            folderContent.className = 'folder-content';
            folderContent.style.display = isExpanded ? 'block' : 'none';
            container.appendChild(folderContent);

            folderItem.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    const isNowExpanded = folderContent.style.display === 'none';
                    folderContent.style.display = isNowExpanded ? 'block' : 'none';
                    icon.textContent = isNowExpanded ? '▼' : '▶';
                    if (isNowExpanded) {
                        state.addExpandedFolder(node.id);
                    } else {
                        state.removeExpandedFolder(node.id);
                    }
                }
            });
            renderBookmarks(node.children, folderContent, node.id, refreshBookmarksCallback);
        }
    });
}

// --- 新增：主題切換功能 ---

/**
 * 應用指定的主題到文檔的 body 上。
 * @param {string} themeName - 要應用的主題名稱 (e.g., 'geek', 'google')。
 */
export function applyTheme(themeName) {
    document.body.dataset.theme = themeName;
}

/**
 * 初始化主題切換器。
 * - 從存儲中加載並應用保存的主題。
 * - 為設定面板和主題選項添加事件監聽器。
 */
export function initThemeSwitcher() {
    const settingsToggle = document.getElementById('settings-toggle');
    console.log('settingsToggle element:', settingsToggle); // DEBUG

    // 點擊設定圖示，彈出設定對話框
    settingsToggle.addEventListener('click', async () => {
        console.log('Settings toggle clicked!'); // DEBUG
        const currentTheme = document.body.dataset.theme || 'geek';

        const themeOptions = [
            { value: 'geek', labelKey: 'themeOptionGeek' },
            { value: 'google', labelKey: 'themeOptionGoogle' },
            { value: 'darcula', labelKey: 'themeOptionDarcula' },
            { value: 'geek-blue', labelKey: 'themeOptionGeekBlue' }
        ];

        const themeSelectHtml = `
            <select id="theme-select-dropdown" class="modal-select">
                ${themeOptions.map(option => `
                    <option value="${option.value}" ${currentTheme === option.value ? 'selected' : ''}>
                        ${api.getMessage(option.labelKey)}
                    </option>
                `).join('')}
            </select>
        `;

        // Fetch current shortcut
        let currentShortcut = 'N/A';
        let newTabRightShortcut = 'N/A';
        try {
            const commands = await chrome.commands.getAll();
            console.log('All commands:', commands); // DEBUG
            const toggleCommand = commands.find(cmd => cmd.name === '_execute_action');
            console.log('Toggle command:', toggleCommand); // DEBUG
            if (toggleCommand && toggleCommand.shortcut) {
                currentShortcut = toggleCommand.shortcut;
            }
            const newTabRightCommand = commands.find(cmd => cmd.name === 'create-new-tab-right');
            if (newTabRightCommand && newTabRightCommand.shortcut) {
                newTabRightShortcut = newTabRightCommand.shortcut;
            }
        } catch (error) {
            console.error('Failed to get commands:', error);
        }

        const content = `
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('themeSectionHeader')}</h4>
                <div class="theme-options">
                    ${themeSelectHtml}
                </div>
            </div>
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('shortcutSectionHeader')}</h4>
                <p>${api.getMessage('shortcutExplanation')}</p>
                <p>${api.getMessage('currentShortcutLabel')} <span id="current-shortcut">${currentShortcut}</span></p>
                <p>${api.getMessage('settingsShortcutCreateTabRight')} <span                                                    
           id="create-new-tab-right-shortcut">${newTabRightShortcut}</span></p>
                <button id="open-shortcuts-button" class="modal-button">${api.getMessage('shortcutLinkText')}</button>
            </div>
            <div class="settings-section">
                <h4 class="settings-section-header">${api.getMessage('sidePanelPositionSectionHeader')}</h4>
                <p>${api.getMessage('sidePanelPositionExplanation')}</p>
                <button id="open-appearance-settings-button" class="modal-button">${api.getMessage('sidePanelPositionLinkText')}</button>
            </div>
        `;

        console.log('Calling showCustomDialog...'); // DEBUG
        await modal.showCustomDialog({
            title: api.getMessage('settingsTitle'),
            content: content,
            onOpen: (modalContentElement) => {
                // 在對話框內容被添加到 DOM 後，綁定事件監聽器
                const themeSelectDropdown = modalContentElement.querySelector('#theme-select-dropdown');
                if (themeSelectDropdown) {
                    themeSelectDropdown.addEventListener('change', (event) => {
                        const newTheme = event.target.value;
                        applyTheme(newTheme);
                        api.setStorage('sync', { theme: newTheme });
                    });
                }
                const openShortcutsButton = modalContentElement.querySelector('#open-shortcuts-button');
                if (openShortcutsButton) {
                    openShortcutsButton.addEventListener('click', () => {
                        chrome.runtime.sendMessage({ action: 'openShortcutsPage' });
                    });
                }
                const openAppearanceSettingsButton = modalContentElement.querySelector('#open-appearance-settings-button');
                if (openAppearanceSettingsButton) {
                    openAppearanceSettingsButton.addEventListener('click', () => {
                        chrome.runtime.sendMessage({ action: 'openAppearanceSettingsPage' });
                    });
                }
            }
        });
    });

    // 從存儲中加載並應用主題 (首次載入時)
    api.getStorage('sync', { theme: 'geek' }).then(data => {
        applyTheme(data.theme);
    });
}