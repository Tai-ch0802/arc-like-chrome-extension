import * as api from './modules/apiManager.js';
import * as ui from './modules/uiManager.js';
import * as search from './modules/searchManager.js';
import * as dragDrop from './modules/dragDropManager.js';

// --- 主要協調器 ---

async function updateTabList() {
    const [groups, tabs] = await Promise.all([
        api.getTabGroupsInCurrentWindow(),
        api.getTabsInCurrentWindow()
    ]);
    ui.renderTabsAndGroups(tabs, groups);
    search.filterTabsAndGroups(ui.searchBox.value.toLowerCase().trim());
    dragDrop.initializeTabSortable(updateTabList);
}

async function refreshBookmarks() {
    const tree = await api.getBookmarkTree();
    if (tree[0] && tree[0].children) {
        ui.bookmarkListContainer.innerHTML = '';
        ui.renderBookmarks(tree[0].children, ui.bookmarkListContainer, '1', refreshBookmarks);
        search.filterBookmarks(ui.searchBox.value.toLowerCase().trim());
        dragDrop.initializeBookmarkSortable(refreshBookmarks, updateTabList);
    }
}

// --- 初始化 ---

function applyStaticTranslations() {
    document.title = api.getMessage("extensionName");
    ui.searchBox.placeholder = api.getMessage("searchPlaceholder");
}

function initialize() {
    applyStaticTranslations();
    search.initialize();
    updateTabList();
    refreshBookmarks();
    addEventListeners();
}

function addEventListeners() {
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
}

// --- 啟動 ---
initialize();
