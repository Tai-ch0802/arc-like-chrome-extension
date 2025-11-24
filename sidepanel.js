import * as api from './modules/apiManager.js';
import * as ui from './modules/uiManager.js';
import * as search from './modules/searchManager.js';
import * as dragDrop from './modules/dragDropManager.js';
import * as modal from './modules/modalManager.js';
import * as state from './modules/stateManager.js';

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
    // 觸發搜尋以套用當前的過濾狀態
    search.handleSearch();
    dragDrop.initializeTabSortable(updateTabList);
}

async function refreshBookmarks() {
    const tree = await api.getBookmarkTree();
    if (tree[0] && tree[0].children) {
        ui.bookmarkListContainer.innerHTML = '';
        ui.renderBookmarks(tree[0].children, ui.bookmarkListContainer, '1', refreshBookmarks);
        // 觸發搜尋以套用當前的過濾狀態
        search.handleSearch();
        dragDrop.initializeBookmarkSortable(refreshBookmarks, updateTabList);
    }
}

// --- 初始化 ---

function applyStaticTranslations() {
    document.title = api.getMessage("extensionName");
    ui.searchBox.placeholder = api.getMessage("searchPlaceholder");
}

async function initialize() {
    await state.initLinkedTabs(); // Load linked tabs state first
    await state.initVirtualScrolling(); // Load virtual scrolling state
    console.log('initialize() called'); // DEBUG
    applyStaticTranslations(); console.log('applyStaticTranslations done');
    search.initialize(); console.log('search.initialize done');
    ui.initThemeSwitcher(); console.log('ui.initThemeSwitcher done'); // 初始化主題切換器
    updateTabList(); console.log('updateTabList done');
    refreshBookmarks(); console.log('refreshBookmarks done');
    addEventListeners(); console.log('addEventListeners done');
    initializeSearchUI(); console.log('initializeSearchUI done');

    // Listen for refresh request from settings
    document.addEventListener('refreshBookmarksRequired', () => {
        refreshBookmarks();
    });
}

function addEventListeners() {
    // --- 事件監聽 ---
    chrome.tabs.onCreated.addListener(updateTabList);
    chrome.tabs.onActivated.addListener(updateTabList);
    chrome.tabs.onMoved.addListener(updateTabList);
    chrome.tabs.onAttached.addListener(updateTabList);
    chrome.tabs.onDetached.addListener(updateTabList);

    chrome.tabs.onRemoved.addListener(async (tabId) => {
        await state.removeLinkedTabByTabId(tabId);
        updateTabList();
        refreshBookmarks(); // Refresh bookmarks to update icon state
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        updateTabList();
        refreshBookmarks(); // Refresh bookmarks to update icon state
    });

    chrome.tabGroups.onCreated.addListener(updateTabList);
    chrome.tabGroups.onUpdated.addListener(updateTabList);
    chrome.tabGroups.onRemoved.addListener(updateTabList);
    chrome.tabGroups.onMoved.addListener(updateTabList);

    chrome.bookmarks.onRemoved.addListener((id) => {
        state.removeLinksByBookmarkId(id);
        refreshBookmarks();
    });

    chrome.bookmarks.onChanged.addListener((id) => {
        //state.removeLinksByBookmarkId(id);
        refreshBookmarks();
    });

    chrome.bookmarks.onCreated.addListener(refreshBookmarks);
    chrome.bookmarks.onMoved.addListener(refreshBookmarks);
}

// --- 搜尋 UI 事件處理 ---

function initializeSearchUI() {
    // 監聽搜尋框輸入，顯示/隱藏清除按鈕
    ui.searchBox.addEventListener('input', () => {
        if (ui.searchBox.value.trim().length > 0) {
            ui.clearSearchBtn.classList.remove('hidden');
        } else {
            ui.clearSearchBtn.classList.add('hidden');
        }
    });

    // 清除按鈕事件
    ui.clearSearchBtn.addEventListener('click', () => {
        ui.searchBox.value = '';
        ui.clearSearchBtn.classList.add('hidden');
        search.handleSearch(); // 觸發搜尋以重置顯示
    });

    // 監聽搜尋結果更新事件
    document.addEventListener('searchResultUpdated', (e) => {
        ui.updateSearchResultCount(e.detail.tabCount, e.detail.bookmarkCount);
    });
}

// --- 啟動 ---
document.addEventListener('DOMContentLoaded', initialize);
