import * as api from './modules/apiManager.js';
import * as state from './modules/stateManager.js';
import * as ui from './modules/uiManager.js';

// --- 全域變數 ---
let tabSortableInstances = [];
let bookmarkSortableInstances = [];
let folderOpenTimer = null;

function applyStaticTranslations() {
    document.title = api.getMessage("extensionName");
    ui.searchBox.placeholder = api.getMessage("searchPlaceholder");
}

// --- 更新畫面協調器 ---
async function updateTabList() {
    const [groups, tabs] = await Promise.all([
        api.getTabGroupsInCurrentWindow(),
        api.getTabsInCurrentWindow()
    ]);
    ui.renderTabsAndGroups(tabs, groups);
    filterTabsAndGroups(ui.searchBox.value.toLowerCase().trim());
    initializeSortable();
}

async function refreshBookmarks() {
    const tree = await api.getBookmarkTree();
    if (tree[0] && tree[0].children) {
        ui.bookmarkListContainer.innerHTML = '';
        ui.renderBookmarks(tree[0].children, ui.bookmarkListContainer, '1', refreshBookmarks);
        initializeBookmarkSortable();
        filterBookmarks(ui.searchBox.value.toLowerCase().trim());
    }
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
    tabSortableInstances.push(new Sortable(ui.tabListContainer, sortableOptions));
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
        await api.groupTabs([tabIdToMove], targetGroupId);
    } else if (to.id === 'tab-list') {
        await api.ungroupTabs(tabIdToMove);
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
            const tab = await api.getTab(targetTabId);
            targetAbsoluteIndex = tab.index;
        } else if (targetElement.classList.contains('tab-group-header')) {
            const targetGroupId = parseInt(targetElement.dataset.groupId, 10);
            const tabsInGroup = await api.getTabsInCurrentWindow({ groupId: targetGroupId });
            if (tabsInGroup.length > 0) {
                targetAbsoluteIndex = Math.min(...tabsInGroup.map(t => t.index));
            }
        }
    }
    if (item.classList.contains('tab-item')) {
        const tabIdToMove = parseInt(item.dataset.tabId, 10);
        api.moveTab(tabIdToMove, targetAbsoluteIndex);
    } else if (item.classList.contains('tab-group-header')) {
        const groupIdToMove = parseInt(item.dataset.groupId, 10);
        api.moveTabGroup(groupIdToMove, targetAbsoluteIndex);
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
    const sortableContainers = [ui.bookmarkListContainer, ...document.querySelectorAll('.folder-content')];
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
            await api.createBookmark({
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
        const destinationChildren = await api.getBookmarkChildren(newParentId);
        const safeIndex = Math.min(newIndex, destinationChildren.length);
        await api.moveBookmark(bookmarkId, {
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

// --- 搜尋邏輯 (拆分) ---
function handleSearch() {
    const query = ui.searchBox.value.toLowerCase().trim();
    filterTabsAndGroups(query);
    filterBookmarks(query);
}
function filterBookmarks(query) {
    const visibleBookmarkNodes = new Set();
    if (ui.bookmarkListContainer.children.length > 0) {
        const topLevelItems = ui.bookmarkListContainer.querySelectorAll(':scope > .bookmark-item, :scope > .bookmark-folder');
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
    const allItems = ui.bookmarkListContainer.querySelectorAll('.bookmark-item, .bookmark-folder');
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
                if (state.isFolderExpanded(node.dataset.bookmarkId)) {
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

// --- 初始化 ---
function initialize() {
    applyStaticTranslations();
    updateTabList();
    refreshBookmarks();
    ui.searchBox.addEventListener('input', handleSearch);
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
