// --- DOM 元素獲取 ---
const tabListContainer = document.getElementById('tab-list');
const bookmarkListContainer = document.getElementById('bookmark-list');
const searchBox = document.getElementById('search-box');

// --- 全域變數 ---
let tabSortableInstances = [];
let bookmarkSortableInstances = [];
let folderOpenTimer = null;
let expandedBookmarkFolders = new Set();

function applyStaticTranslations() {
    document.title = chrome.i18n.getMessage("extensionName");
    searchBox.placeholder = chrome.i18n.getMessage("searchPlaceholder");
}

// --- Tab 拖曳功能 ---
function initializeSortable() {
    tabSortableInstances.forEach(instance => instance.destroy());
    tabSortableInstances = [];
    const sortableOptions = {
        group: {
            name: 'shared-list',
            pull: true,
            put: true
        },
        animation: 150,
        onEnd: handleDragEnd,
        onAdd: handleDragAdd,
    };
    tabSortableInstances.push(new Sortable(tabListContainer, sortableOptions));
    document.querySelectorAll('.tab-group-content').forEach(groupContent => {
        tabSortableInstances.push(new Sortable(groupContent, sortableOptions));
    });
}
async function handleDragEnd(evt) {
    if (evt.to.closest('#bookmark-list')) {
        return;
    }
    const { item, newIndex } = evt;
    await moveItem(item, newIndex, evt.to);
}
async function handleDragAdd(evt) {
    const { item, newIndex, to, from } = evt;
    if (item.classList.contains('bookmark-item') || item.classList.contains('bookmark-folder')) {
        from.appendChild(item);
        return;
    }
    const tabIdToMove = parseInt(item.dataset.tabId, 10);
    if (!tabIdToMove) return;
    if (to.classList.contains('tab-group-content')) {
        const header = to.previousElementSibling;
        const targetGroupId = parseInt(header.dataset.groupId, 10);
        await chrome.tabs.group({ tabIds: [tabIdToMove], groupId: targetGroupId });
    } else if (to.id === 'tab-list') {
        await chrome.tabs.ungroup(tabIdToMove);
    }
    await moveItem(item, newIndex, to);
}
async function moveItem(item, newIndex, container) {
    const allDraggables = Array.from(container.closest('#tab-list').querySelectorAll('.tab-item, .tab-group-header'));
    const droppedItemElement = allDraggables.find(el => el === item);
    const actualNewIndex = allDraggables.indexOf(droppedItemElement);
    const targetElement = allDraggables[actualNewIndex + 1];
    let targetAbsoluteIndex = -1;
    if (targetElement) {
        if (targetElement.classList.contains('tab-item')) {
            const targetTabId = parseInt(targetElement.dataset.tabId, 10);
            const tab = await chrome.tabs.get(targetTabId);
            targetAbsoluteIndex = tab.index;
        } else if (targetElement.classList.contains('tab-group-header')) {
            const targetGroupId = parseInt(targetElement.dataset.groupId, 10);
            const tabsInGroup = await chrome.tabs.query({ groupId: targetGroupId });
            if (tabsInGroup.length > 0) {
                targetAbsoluteIndex = Math.min(...tabsInGroup.map(t => t.index));
            }
        }
    }
    if (item.classList.contains('tab-item')) {
        const tabIdToMove = parseInt(item.dataset.tabId, 10);
        chrome.tabs.move(tabIdToMove, { index: targetAbsoluteIndex });
    } else if (item.classList.contains('tab-group-header')) {
        const groupIdToMove = parseInt(item.dataset.groupId, 10);
        chrome.tabGroups.move(groupIdToMove, { index: targetAbsoluteIndex });
    }
}

// --- 書籤拖曳功能 ---
function initializeBookmarkSortable() {
    bookmarkSortableInstances.forEach(instance => instance.destroy());
    bookmarkSortableInstances = [];
    const sortableOptions = {
        group: 'shared-list',
        animation: 150,
        onEnd: handleBookmarkDrop,
        onAdd: handleBookmarkDrop,
        onDragOver: function (evt) {
            clearTimeout(folderOpenTimer);
            const { related } = evt;
            const isCollapsedFolder = related.classList.contains('bookmark-folder') && related.querySelector('.bookmark-icon').textContent === '▶';
            if (isCollapsedFolder) {
                folderOpenTimer = setTimeout(() => {
                    related.click();
                }, 1000);
            }
        },
    };
    const sortableContainers = [bookmarkListContainer, ...document.querySelectorAll('.folder-content')];
    sortableContainers.forEach(container => {
        bookmarkSortableInstances.push(new Sortable(container, sortableOptions));
    });
}
async function handleBookmarkDrop(evt) {
    const { item, to, newIndex } = evt;
    if (item.classList.contains('tab-item')) {
        const title = item.querySelector('.tab-title').textContent;
        const url = item.dataset.url;
        const parentId = to.dataset.parentId;
        if (title && url && parentId) {
            await chrome.bookmarks.create({
                parentId: parentId,
                title: title,
                url: url,
                index: newIndex
            });
            item.remove();
            refreshBookmarks();
            updateTabList();
        }
        return;
    }
    const bookmarkId = item.dataset.bookmarkId;
    const newParentId = to.dataset.parentId;
    if (!bookmarkId || !newParentId) return;
    try {
        const destinationChildren = await chrome.bookmarks.getChildren(newParentId);
        const safeIndex = Math.min(newIndex, destinationChildren.length);
        await chrome.bookmarks.move(bookmarkId, {
            parentId: newParentId,
            index: safeIndex
        });
        refreshBookmarks();
    } catch (error) {
        console.error("Failed to move bookmark with safe index. Details:", {
            bookmarkId,
            newParentId,
            originalIndex: newIndex,
            safeIndex,
            error
        });
        refreshBookmarks();
    }
}
function refreshBookmarks() {
    chrome.bookmarks.getTree(tree => {
        if (tree[0] && tree[0].children) {
            bookmarkListContainer.innerHTML = '';
            renderBookmarks(tree[0].children, bookmarkListContainer, '1'); 
            initializeBookmarkSortable();
            filterBookmarks(searchBox.value.toLowerCase().trim());
        }
    });
}

// --- 搜尋邏輯 (拆分) ---
function handleSearch() {
    const query = searchBox.value.toLowerCase().trim();
    filterTabsAndGroups(query);
    filterBookmarks(query);
}
function filterBookmarks(query) {
    const visibleBookmarkNodes = new Set();
    if (bookmarkListContainer.children.length > 0) {
        const topLevelItems = bookmarkListContainer.querySelectorAll(':scope > .bookmark-item, :scope > .bookmark-folder');
        for (const item of topLevelItems) {
            calculateBookmarkVisibility(item, query, visibleBookmarkNodes);
        }
    }
    applyBookmarkVisibility(query, visibleBookmarkNodes);
}
function filterTabsAndGroups(query) {
    const tabItems = document.querySelectorAll('#tab-list .tab-item');
    const groupHeaders = document.querySelectorAll('#tab-list .tab-group-header');
    tabItems.forEach(item => {
        const title = item.querySelector('.tab-title').textContent.toLowerCase();
        const matches = title.includes(query);
        item.classList.toggle('hidden', !matches);
    });
    groupHeaders.forEach(header => {
        const content = header.nextElementSibling;
        const visibleTabsInGroup = content.querySelectorAll('.tab-item:not(.hidden)');
        const titleElement = header.querySelector('.tab-group-title');
        const title = titleElement ? titleElement.textContent.toLowerCase() : '';
        const groupTitleMatches = title.includes(query);
        const hasVisibleChildren = visibleTabsInGroup.length > 0;
        header.classList.toggle('hidden', !hasVisibleChildren && !groupTitleMatches);
        if ((hasVisibleChildren || groupTitleMatches) && query) {
            content.style.display = 'block';
            header.querySelector('.tab-group-arrow').textContent = '▼';
        } else if (!query) {
            const isCollapsed = header.dataset.collapsed === 'true';
            content.style.display = isCollapsed ? 'none' : 'block';
            header.querySelector('.tab-group-arrow').textContent = isCollapsed ? '▶' : '▼';
        }
    });
}
function calculateBookmarkVisibility(node, query, visibleItems) {
    const titleElement = node.querySelector('.bookmark-title');
    if (!titleElement) return false;
    const title = titleElement.textContent.toLowerCase();
    const selfMatches = query ? title.includes(query) : true;
    let hasVisibleChild = false;
    if (node.classList.contains('bookmark-folder')) {
        const content = node.nextElementSibling;
        if (content && content.classList.contains('folder-content')) {
            for (const child of content.children) {
                if (calculateBookmarkVisibility(child, query, visibleItems)) {
                    hasVisibleChild = true;
                }
            }
        }
    }
    const shouldBeVisible = selfMatches || hasVisibleChild;
    if (shouldBeVisible) {
        visibleItems.add(node);
    }
    return shouldBeVisible;
}
function applyBookmarkVisibility(query, visibleItems) {
    const allItems = bookmarkListContainer.querySelectorAll('.bookmark-item, .bookmark-folder');
    allItems.forEach(node => {
        const isVisible = visibleItems.has(node);
        node.classList.toggle('hidden', !isVisible);
        if (node.classList.contains('bookmark-folder')) {
            const content = node.nextElementSibling;
            const icon = node.querySelector('.bookmark-icon');
            if (isVisible && query) {
                let shouldExpand = false;
                if (content) {
                     for(const child of content.children) {
                        if (visibleItems.has(child)) {
                            shouldExpand = true;
                            break;
                        }
                    }
                }
                if (shouldExpand) {
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '▶';
                }
            } else {
                if (expandedBookmarkFolders.has(node.dataset.bookmarkId)) {
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '▶';
                }
            }
        }
    });
}

// --- 渲染邏輯 ---
function createTabElement(tab) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    if (tab.active) {
        tabItem.classList.add('active');
    }
    tabItem.dataset.tabId = tab.id;
    tabItem.dataset.url = tab.url;
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
        chrome.tabs.remove(tab.id);
    });
    tabItem.appendChild(favicon);
    tabItem.appendChild(title);
    tabItem.appendChild(closeBtn);
    tabItem.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
    });
    return tabItem;
}
async function updateTabList() {
    const [groups, tabs] = await Promise.all([
        chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }),
        chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    ]);
    tabListContainer.innerHTML = ''; 
    const groupsMap = new Map(groups.map(group => [group.id, group]));
    const renderedTabIds = new Set();
    for (const tab of tabs) {
        if (renderedTabIds.has(tab.id)) {
            continue;
        }
        const isInGroup = tab.groupId > 0;
        if (isInGroup) {
            const group = groupsMap.get(tab.groupId);
            if (!group) continue;
            const groupHeader = document.createElement('div');
            groupHeader.className = 'tab-group-header';
            groupHeader.dataset.collapsed = group.collapsed;
            groupHeader.dataset.groupId = group.id;
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
                    chrome.tabGroups.update(group.id, { collapsed: !isCollapsed });
                }
            });
        } else {
            const tabElement = createTabElement(tab);
            tabListContainer.appendChild(tabElement);
            renderedTabIds.add(tab.id);
        }
    }
    filterTabsAndGroups(searchBox.value.toLowerCase().trim());
    initializeSortable();
}
function renderBookmarks(bookmarkNodes, container, parentId) {
    container.dataset.parentId = parentId;
    bookmarkNodes.forEach(node => {
        if (node.url) { 
            const bookmarkItem = document.createElement('a');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.dataset.bookmarkId = node.id;
            bookmarkItem.href = node.url;
            bookmarkItem.target = '_blank';
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

            // --- 建立按鈕容器 ---
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'bookmark-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'bookmark-edit-btn';
            editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="m15 5 4 4"></path></svg>`;
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const editBookmarkTitleMsg = chrome.i18n.getMessage("editBookmarkPromptForTitle");
                const newTitle = prompt(editBookmarkTitleMsg, node.title);
                if (newTitle === null) return; // 使用者按了取消

                const editBookmarkUrlMsg = chrome.i18n.getMessage("editBookmarkPromptForUrl");
                const newUrl = prompt(editBookmarkUrlMsg, node.url);
                if (newUrl === null) return; // 使用者按了取消

                chrome.bookmarks.update(node.id, { title: newTitle, url: newUrl }, refreshBookmarks);
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'bookmark-close-btn';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // 使用 i18n API 獲取翻譯，並傳入參數
                const confirmMsg = chrome.i18n.getMessage("deleteBookmarkConfirm", node.title);
                if (confirm(confirmMsg)) {
                    chrome.bookmarks.remove(node.id, () => {
                        refreshBookmarks();
                    });
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
                    chrome.tabs.create({ url: node.url });
                }
            });
            container.appendChild(bookmarkItem);

        } else if (node.children) {
            const folderItem = document.createElement('div');
            folderItem.className = 'bookmark-folder';
            folderItem.dataset.bookmarkId = node.id;
            const isExpanded = expandedBookmarkFolders.has(node.id);
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
                const promptMsg = chrome.i18n.getMessage("editBookmarkFolderPromptForTitle");
                const newTitle = prompt(promptMsg, node.title);
                if (newTitle && newTitle !== node.title) {
                    chrome.bookmarks.update(node.id, { title: newTitle }, refreshBookmarks);
                }
            });

            const addFolderBtn = document.createElement('button');
            addFolderBtn.className = 'add-folder-btn';
            addFolderBtn.textContent = '+';
            addFolderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const promptMsg = chrome.i18n.getMessage("addFolderPrompt", node.title);
                const newFolderName = prompt(promptMsg);
                if (newFolderName) {
                    chrome.bookmarks.create({
                        parentId: node.id,
                        title: newFolderName
                    }, () => {
                        expandedBookmarkFolders.add(node.id);
                        refreshBookmarks();
                    });
                }
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'bookmark-close-btn';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const confirmMsg = chrome.i18n.getMessage("deleteFolderConfirm", node.title);
                if (confirm(confirmMsg)) {
                    chrome.bookmarks.removeTree(node.id, () => {
                        expandedBookmarkFolders.delete(node.id);
                        refreshBookmarks();
                    });
                }
            });

            actionsContainer.appendChild(editBtn);
            if (!node.url) { 
                // 只有資料夾才需要「新增資料夾」按鈕
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
                        expandedBookmarkFolders.add(node.id);
                    } else {
                        expandedBookmarkFolders.delete(node.id);
                    }
                }
            });
            renderBookmarks(node.children, folderContent, node.id);
        }
    });
}

// --- 初始化 ---
function initialize() {
    applyStaticTranslations();
    updateTabList();
    refreshBookmarks(); 
    searchBox.addEventListener('input', handleSearch);
}

initialize();

// --- 事件監聽 ---
chrome.tabs.onCreated.addListener(updateTabList);
chrome.tabs.onUpdated.addListener(updateTabList);
chrome.tabs.onRemoved.addListener(updateTabList);
chrome.tabs.onActivated.addListener(updateTabList);
chrome.tabs.onMoved.addListener(updateTabList);
chrome.tabs.onAttached.addListener(updateTabList);
chrome.tabs.onDetached.addListener(updateTabList);
chrome.tabGroups.onCreated.addListener(updateTabList);
chrome.tabGroups.onUpdated.addListener(updateTabList);
chrome.tabGroups.onRemoved.addListener(updateTabList);
chrome.tabGroups.onMoved.addListener(updateTabList);
chrome.bookmarks.onChanged.addListener(refreshBookmarks);
chrome.bookmarks.onCreated.addListener(refreshBookmarks);
chrome.bookmarks.onRemoved.addListener(refreshBookmarks);
chrome.bookmarks.onMoved.addListener(refreshBookmarks);