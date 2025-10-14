import * as api from './modules/apiManager.js';
import * as ui from './modules/uiManager.js';
import * as search from './modules/searchManager.js';
import * as dragDrop from './modules/dragDropManager.js';
import * as modal from './modules/modalManager.js';

// --- 主要協調器 ---

async function handleAddToGroupClick(tabId) {
    const result = await modal.showCreateGroupDialog();
    if (result && result.title) {
        await api.addTabToNewGroup(tabId, result.title, result.color);
        // The onUpdated and onCreated events from the Chrome API will automatically trigger updateTabList
    }
}

async function updateTabList() {
    const [groups, tabs] = await Promise.all([
        api.getTabGroupsInCurrentWindow(),
        api.getTabsInCurrentWindow()
    ]);
    ui.renderTabsAndGroups(tabs, groups, { onAddToGroupClick: handleAddToGroupClick });
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

// 新增：動態調整 body padding-top 的函式
function adjustBodyPadding() {
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        document.body.style.paddingTop = `${searchContainer.offsetHeight}px`;
    }
}

function initialize() {
    console.log('initialize() called'); // DEBUG
    applyStaticTranslations(); console.log('applyStaticTranslations done');
    search.initialize(); console.log('search.initialize done');
    adjustBodyPadding(); console.log('adjustBodyPadding done');
    ui.initThemeSwitcher(); console.log('ui.initThemeSwitcher done'); // 初始化主題切換器
    updateTabList(); console.log('updateTabList done');
    refreshBookmarks(); console.log('refreshBookmarks done');
    addEventListeners(); console.log('addEventListeners done');
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
document.addEventListener('DOMContentLoaded', initialize);
