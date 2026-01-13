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
        let tabsToGroup = [tabId];
        try {
            const targetTab = await api.getTab(tabId);
            if (targetTab && targetTab.splitViewId && targetTab.splitViewId > 0) {
                const allTabs = await api.getTabsInCurrentWindow();
                const peerTabs = allTabs.filter(t => t.splitViewId === targetTab.splitViewId);
                tabsToGroup = peerTabs.map(t => t.id);
            }
        } catch (err) {
            console.error('Error identifying split view tabs:', err);
            const confirm = await modal.showConfirm({
                title: 'Failed to detect split view tabs. Do you want to proceed with creating a group for this single tab?',
                confirmButtonText: 'Yes',
            });
            if (!confirm) {
                return; // User cancelled
            }
        }

        await api.addTabToNewGroup(tabsToGroup, result.title, result.color);
        // The onUpdated and onCreated events from the Chrome API will automatically trigger updateTabList
    }
}

async function updateTabList() {
    const [groups, tabs, currentWindow, allWindows, allGroups] = await Promise.all([
        api.getTabGroupsInCurrentWindow(),
        api.getTabsInCurrentWindow(),
        api.getCurrentWindow(),
        api.getAllWindowsWithTabs(),
        api.getAllTabGroups()
    ]);
    ui.renderTabsAndGroups(tabs, groups, { onAddToGroupClick: handleAddToGroupClick });
    ui.renderOtherWindowsSection(allWindows, currentWindow.id, allGroups);
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
    await Promise.all([
        state.initLinkedTabs(), // Load linked tabs state first
        state.initWindowNames() // Load window names
    ]);
    await state.pruneWindowNames(); // Prune stale window names on startup
    state.loadBookmarkCache(); // Load cached bookmarks from localStorage
    await state.buildBookmarkCache(); // Build fresh cache on startup
    applyStaticTranslations();
    search.initialize();
    ui.initThemeSwitcher();
    updateTabList();
    refreshBookmarks();
    addEventListeners();
    initializeSearchUI();

    // Listen for refresh request from settings
    document.addEventListener('refreshBookmarksRequired', () => {
        refreshBookmarks();
    });

    // Listen for folder expansion to reinitialize Sortable for dynamically rendered content
    document.addEventListener('folderExpanded', () => {
        dragDrop.initializeBookmarkSortable(refreshBookmarks, updateTabList);
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

    // Window events for other windows section
    chrome.windows.onCreated.addListener(updateTabList);
    chrome.windows.onRemoved.addListener(async (windowId) => {
        await state.removeWindowName(windowId);
        updateTabList();
    });

    chrome.bookmarks.onRemoved.addListener((id) => {
        state.removeLinksByBookmarkId(id);
        state.buildBookmarkCache(); // Rebuild cache on bookmark removal
        refreshBookmarks();
    });

    chrome.bookmarks.onChanged.addListener((id) => {
        //state.removeLinksByBookmarkId(id);
        state.buildBookmarkCache(); // Rebuild cache on bookmark change
        refreshBookmarks();
    });

    chrome.bookmarks.onCreated.addListener(() => {
        state.buildBookmarkCache(); // Rebuild cache on bookmark creation
        refreshBookmarks();
    });
    chrome.bookmarks.onMoved.addListener(() => {
        state.buildBookmarkCache(); // Rebuild cache on bookmark move
        refreshBookmarks();
    });
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
