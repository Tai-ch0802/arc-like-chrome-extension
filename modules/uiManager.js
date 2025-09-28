import * as api from './apiManager.js';
import * as state from './stateManager.js';

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
    tabItem.title = `${tab.title}\n${urlPreview}`; // 使用換行符 \n
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
        favicon.src = tab.favIconUrl;
    } else {
        favicon.src = 'icons/icon_default.svg';
    }
    favicon.onerror = () => {
        favicon.src = 'icons/icon_default.svg';
    };
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'Loading...';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.removeTab(tab.id);
    });
    tabItem.appendChild(favicon);
    tabItem.appendChild(title);
    tabItem.appendChild(closeBtn);
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
            colorDot.style.backgroundColor = group.color;
            const title = document.createElement('span');
            title.className = 'tab-group-title';
            title.textContent = group.title;
            title.style.color = group.color;
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
            try {
                const domain = new URL(node.url).hostname;
                icon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${domain}`;
            } catch (error) {
                icon.src = 'icons/icon_default.svg';
            }
            icon.onerror = () => {
                icon.src = 'icons/icon_default.svg';
            };
            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = node.title;

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'bookmark-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'bookmark-edit-btn';
            editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const newTitle = prompt(api.getMessage("editBookmarkPromptForTitle"), node.title);
                if (newTitle === null) return;

                const newUrl = prompt(api.getMessage("editBookmarkPromptForUrl"), node.url);
                if (newUrl === null) return;

                api.updateBookmark(node.id, { title: newTitle, url: newUrl }).then(refreshBookmarksCallback);
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'bookmark-close-btn';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const confirmMsg = api.getMessage("deleteBookmarkConfirm", node.title);
                if (confirm(confirmMsg)) {
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
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newFolderName = prompt(api.getMessage("editBookmarkFolderPromptForTitle"), node.title);
                if (newFolderName && newFolderName !== node.title) {
                    api.updateBookmark(node.id, { title: newFolderName }).then(refreshBookmarksCallback);
                }
            });

            const addFolderBtn = document.createElement('button');
            addFolderBtn.className = 'add-folder-btn';
            addFolderBtn.textContent = '+';
            addFolderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newFolderName = prompt(api.getMessage("addFolderPrompt", node.title));
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
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const confirmMsg = api.getMessage("deleteFolderConfirm", node.title);
                if (confirm(confirmMsg)) {
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