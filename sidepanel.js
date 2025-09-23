// --- DOM 元素獲取 ---
const tabListContainer = document.getElementById('tab-list');
const bookmarkListContainer = document.getElementById('bookmark-list');
const searchBox = document.getElementById('search-box');

// --- 全域變數 ---
let tabSortableInstances = [];
let bookmarkSortableInstances = [];

// --- Tab 拖曳功能 ---
function initializeSortable() {
    tabSortableInstances.forEach(instance => instance.destroy());
    tabSortableInstances = [];
    const sortableOptions = {
        group: 'tabs',
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
    const { item, newIndex } = evt;
    await moveItem(item, newIndex, evt.to);
}
async function handleDragAdd(evt) {
    const { item, newIndex, to } = evt;
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
        group: 'bookmarks',
        animation: 150,
        onEnd: handleBookmarkDrop,
        onAdd: handleBookmarkDrop,
    };
    const sortableContainers = [bookmarkListContainer, ...document.querySelectorAll('.folder-content')];
    sortableContainers.forEach(container => {
        bookmarkSortableInstances.push(new Sortable(container, sortableOptions));
    });
}
async function handleBookmarkDrop(evt) {
    const { item, to, newIndex } = evt;
    const bookmarkId = item.dataset.bookmarkId;
    const newParentId = to.dataset.parentId;
    if (!bookmarkId || !newParentId) {
        console.error("Missing bookmark ID or new parent ID.");
        return;
    }
    try {
        await chrome.bookmarks.move(bookmarkId, {
            parentId: newParentId,
            index: newIndex
        });
        refreshBookmarks();
    } catch (error) {
        console.error("Failed to move bookmark:", error);
        refreshBookmarks();
    }
}
function refreshBookmarks() {
    chrome.bookmarks.getTree(tree => {
        if (tree[0] && tree[0].children) {
            bookmarkListContainer.innerHTML = '';
            renderBookmarks(tree[0].children, bookmarkListContainer, '1');
            initializeBookmarkSortable();
            handleSearch();
        }
    });
}

// --- 搜尋邏輯 ---
function handleSearch() {
    const query = searchBox.value.toLowerCase().trim();
    filterTabsAndGroups(query);
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
                content.style.display = 'none';
                icon.textContent = '▶';
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
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
        favicon.src = tab.favIconUrl;
    } else {
        favicon.src = 'icon_default.svg';
    }
    favicon.onerror = () => { 
        favicon.src = 'icon_default.svg'; 
    };
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || '載入中...';
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
    handleSearch();
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
            const icon = document.createElement('span');
            icon.className = 'bookmark-icon';
            icon.textContent = '★';
            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = node.title;
            bookmarkItem.appendChild(icon);
            bookmarkItem.appendChild(title);
            bookmarkItem.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url: node.url });
            });
            container.appendChild(bookmarkItem);
        } else if (node.children) {
            const folderItem = document.createElement('div');
            folderItem.className = 'bookmark-folder';
            folderItem.dataset.bookmarkId = node.id;
            const icon = document.createElement('span');
            icon.className = 'bookmark-icon';
            icon.textContent = '▶';
            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = node.title;
            folderItem.appendChild(icon);
            folderItem.appendChild(title);
            container.appendChild(folderItem);
            const folderContent = document.createElement('div');
            folderContent.className = 'folder-content';
            folderContent.style.display = 'none';
            container.appendChild(folderContent);
            folderItem.addEventListener('click', () => {
                const isHidden = folderContent.style.display === 'none';
                folderContent.style.display = isHidden ? 'block' : 'none';
                icon.textContent = isHidden ? '▼' : '▶';
            });
            renderBookmarks(node.children, folderContent, node.id);
        }
    });
}

// --- 初始化 ---
function initialize() {
    updateTabList();
    chrome.bookmarks.getTree(tree => {
        if (tree[0] && tree[0].children) {
            bookmarkListContainer.innerHTML = '';
            renderBookmarks(tree[0].children, bookmarkListContainer, '1');
            initializeBookmarkSortable();
            handleSearch();
        }
    });
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