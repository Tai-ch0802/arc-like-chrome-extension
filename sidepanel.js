import * as api from './modules/apiManager.js';
import * as ui from './modules/uiManager.js';
import * as search from './modules/searchManager.js';
import * as dragDrop from './modules/dragDropManager.js';
import * as modal from './modules/modalManager.js';
import * as state from './modules/stateManager.js';
import * as keyboard from './modules/keyboardManager.js';
import * as readingListManager from './modules/readingListManager.js';
import * as readingListRenderer from './modules/ui/readingListRenderer.js';
import * as rssManager from './modules/rssManager.js';
import * as hoverSummarize from './modules/ui/hoverSummarizeManager.js';
import * as workspaceManager from './modules/workspace/workspaceManager.js';
import { initWorkspaceUI } from './modules/workspace/workspaceUI.js';
import * as tagManager from './modules/bookmark/tagManager.js';
import { openBookmarkToolsDialog } from './modules/bookmark/bookmarkToolsUI.js';
import * as readingListSummaryStore from './modules/readingList/summaryStore.js';
import { initSummaryRecorder } from './modules/readingList/summaryRecorder.js';
import { SEARCH_NO_RESULTS_ICON_SVG, renderIcon } from './modules/icons.js';
import { debounce } from './modules/utils/functionUtils.js';
import { initSettingsBridge } from './modules/ui/settingsBridge.js';
import { initAiProviderErrorToast, initRssSyncOnboarding } from './modules/ui/toast.js';
import { initDriveSyncBadge } from './modules/ui/driveSyncBadge.js';

// --- Spotlight 轉送動作處理 ---

// 側邊欄完成初始化(按鈕等事件已綁定)前不消費轉送動作,避免點到尚未接線的按鈕。
let panelReady = false;

// Spotlight(獨立視窗)轉送來的 UI 類動作:在側邊欄正確情境執行。
const PANEL_ACTION_HANDLERS = {
    'smart-group': () => document.getElementById('ai-group-btn')?.click(),
    'ai-cleanup': () => document.getElementById('ai-cleanup-btn')?.click(),
    'page-reader': () => document.getElementById('page-reader-btn')?.click(),
    'bookmark-tools': () => document.getElementById('bookmark-tools-btn')?.click(),
    'manage-workspaces': () => document.getElementById('workspace-switch-btn')?.click(),
    'refresh-bookmarks': () => document.dispatchEvent(new CustomEvent('refreshBookmarksRequired')),
    'ask-ai-search': async () => {
        const { openAskAiDialog } = await import('./modules/commandPalette/nlSearch.js');
        await openAskAiDialog();
    },
    'create-workspace': async () => {
        const { createWorkspaceFromCurrent } = await import('./modules/workspace/workspaceUI.js');
        await createWorkspaceFromCurrent();
    },
    'switch-workspace': async (extra) => {
        const { requestSwitchTo } = await import('./modules/workspace/workspaceUI.js');
        if (extra && extra.workspaceId) await requestSwitchTo(extra.workspaceId);
    },
};

// 本 panel 所屬視窗 id:消費轉送動作前必須先知道「我是誰」(定址守門用)。
let myWindowIdPromise = null;
function getMyWindowId() {
    if (!myWindowIdPromise) {
        myWindowIdPromise = chrome.windows.getCurrent()
            .then(w => w.id)
            .catch(() => null);
    }
    return myWindowIdPromise;
}

async function consumePendingPanelAction() {
    // 初始化尚未完成時不消費:旗標保留,待 initialize 末端設定 panelReady 後再讀取,
    // 避免在按鈕事件接線前觸發動作而被吞掉(亦不漏動作)。
    if (!panelReady) return;
    let pending;
    try {
        ({ pendingPanelAction: pending } = await chrome.storage.session.get('pendingPanelAction'));
    } catch { return; }
    if (!pending || !pending.id) return;

    // 定址 + TTL 守門(ISSUE-162 A1/A3):動作寄給特定視窗;非目標 panel
    // 一律不碰(也不清旗標——目標 panel 可能還在初始化);過期動作清掉,
    // 防 sidePanel.open 失敗後旗標殘留、之後突發執行。
    const { classifyPendingAction } = await import('./modules/commandPalette/panelBridge.js');
    const verdict = classifyPendingAction(pending, await getMyWindowId(), Date.now());
    if (verdict === 'ignore') return;
    try { await chrome.storage.session.remove('pendingPanelAction'); } catch { /* ignore */ }
    if (verdict === 'expired') {
        console.warn('[panel-action] dropped expired action:', pending.id);
        return;
    }
    const fn = PANEL_ACTION_HANDLERS[pending.id];
    if (!fn) { console.warn('[panel-action] unknown id:', pending.id); return; }
    try { await fn(pending); }
    catch (err) { console.warn('[panel-action] failed:', err && err.message ? err.message : err); }
}

chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.pendingPanelAction && changes.pendingPanelAction.newValue) {
        consumePendingPanelAction();
    }
});

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
                title: api.getMessage('splitViewDetectionError'),
                confirmButtonText: api.getMessage('yesButton'),
            });
            if (!confirm) {
                return; // User cancelled
            }
            tabsToGroup = [tabId];
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

async function refreshReadingList() {
    const entries = await readingListManager.getAllEntries();
    const container = document.getElementById('reading-list');
    if (container) {
        readingListRenderer.renderReadingList(entries, container, refreshReadingList);
    }
}

function applyReadingListVisibility(visible) {
    const section = document.getElementById('reading-list-section');
    if (section) {
        section.style.display = visible ? '' : 'none';
    }
}

// --- 初始化 ---

function applyStaticTranslations() {
    document.title = api.getMessage("extensionName");
    ui.searchBox.placeholder = api.getMessage("searchPlaceholder");

    // Apply accessible labels and titles
    ui.searchBox.setAttribute('aria-label', api.getMessage("searchAriaLabel"));

    const clearSearchLabel = api.getMessage("clearSearchAriaLabel");
    ui.clearSearchBtn.setAttribute('aria-label', clearSearchLabel);
    ui.clearSearchBtn.title = clearSearchLabel;

    const settingsToggle = document.getElementById('settings-toggle');
    if (settingsToggle) {
        const settingsLabel = api.getMessage("settingsAriaLabel");
        settingsToggle.setAttribute('aria-label', settingsLabel);
        settingsToggle.title = settingsLabel;
    }

    // Process all data-i18n attributes for static text elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = api.getMessage(key);
        if (message) {
            el.textContent = message;
        }
    });

    // data-i18n-title:tooltip 在地化(ISSUE-162 C4)。先前無任何處理迴圈,
    // 6 個元素的 title 永遠是空字串或硬編碼英文(14 語系皆然)。icon-only
    // 按鈕缺 aria-label 時一併補上。
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const msg = api.getMessage(el.getAttribute('data-i18n-title'));
        if (msg) {
            el.title = msg;
            if (!el.hasAttribute('aria-label') || !el.getAttribute('aria-label')) {
                el.setAttribute('aria-label', msg);
            }
        }
    });

    // 注入 Material Symbols 圖示:[data-icon] 元素(icon-only 按鈕或 .btn-icon span)。
    // 與 data-i18n 分離(label 在 .btn-label),故文字在地化不會洗掉圖示。
    document.querySelectorAll('[data-icon]').forEach(el => {
        const size = parseInt(el.dataset.iconSize, 10) || 16;
        el.innerHTML = renderIcon(el.dataset.icon, { size });
    });
}

async function initialize() {
    const [, , , readingListVisible, aiGroupingVisible, uiLang, , , ] = await Promise.all([
        state.initLinkedTabs(), // Load linked tabs state first
        state.initWindowNames(), // Load window names
        state.loadBookmarkCache(), // Load cached bookmarks from storage
        state.initReadingListVisibility(), // Load Reading List visibility
        state.initAiGroupingVisibility(), // Load AI Grouping visibility
        state.initUiLanguage(), // Load UI Language Override state
        state.initHoverSummarize(), // Load Hover Summarize state
        state.initAiAutoNaming(), // Load AI Auto Naming state (drives bg listener gating via storage)
        state.initAiCleanupVisibility(), // Load AI Cleanup visibility state
        state.initPageReaderVisibility(), // Load Page Reader visibility state
        state.initNewswireVisibility() // Load Newswire visibility state (BASE-016)
    ]);

    // Ensure custom language dictionary is loaded BEFORE applying any translations
    await api.loadCustomI18n(uiLang);

    state.pruneWindowNames().catch(console.error); // Non-blocking: only removes stale window IDs

    // Cold start (first install / cleared cache) must await so the first search isn't empty.
    // Warm start stays non-blocking and notifies search to re-run with fresh data.
    // Check the init flag — not cache length — so users with zero bookmarks
    // don't get treated as cold-start on every launch.
    let pendingWarmCacheRebuild = false;
    if (!state.isBookmarkCacheInitialized()) {
        await state.buildBookmarkCache();
    } else {
        // 暖啟動:目前 cache 是上個 session 的持久化快照,真正內容要等
        // 這個背景 rebuild 完成(bookmarkCacheReady)。tag prune 等
        // 「不可拿陳舊快照做破壞性決策」的工作須等該事件(ISSUE-162 B6)。
        pendingWarmCacheRebuild = true;
        state.buildBookmarkCache()
            .then(() => {
                pendingWarmCacheRebuild = false;
                document.dispatchEvent(new CustomEvent('bookmarkCacheReady'));
            })
            .catch(console.error);
    }
    applyStaticTranslations();

    // Inject centralized icons
    const noResultsIconContainer = document.querySelector('.no-results-icon');
    if (noResultsIconContainer) {
        noResultsIconContainer.innerHTML = SEARCH_NO_RESULTS_ICON_SVG;
    }

    search.initialize();
    ui.initThemeSwitcher();
    ui.initAiGrouper();
    ui.initAiCleanup();
    ui.initPageReader();
    // 區塊排序(BASE-015):在首次內容渲染前套用 wrapper 順序,避免內容先以
    // 預設序繪出再跳動;後續變更由 settingsBridge 的 sectionOrderChanged 驅動。
    await ui.initSectionOrder();
    // Workspace cache must be loaded BEFORE the first updateTabList(): the
    // Other Windows section titles windows by their bound workspace's name.
    await workspaceManager.initWorkspaces();
    await updateTabList();

    refreshBookmarks();
    refreshReadingList();
    applyReadingListVisibility(state.isReadingListVisible());
    addEventListeners();
    initializeSearchUI();
    // Options page writes only to chrome.storage; react to those changes here.
    initSettingsBridge();
    initAiProviderErrorToast();

    rssManager.initRssManager()
        .then(() => initRssSyncOnboarding())
        .catch(console.error);
    // 快訊區塊(BASE-016 N1):經 SW getState 回填+訂閱廣播;不進首屏關鍵路徑。
    ui.initNewswireSection().catch(console.error);
    keyboard.initialize();
    hoverSummarize.init(); // Initialize Hover Summarize feature
    // Workspace switcher dropdown + manage dialog. (Cache already loaded above,
    // before the first updateTabList.) onWorkspacesChanged keeps the Other
    // Windows titles in step with binding changes — e.g. the background
    // lifecycle re-binding a session-restored window.
    await initWorkspaceUI({ onWorkspacesChanged: () => updateTabList() });
    // Drive-sync status badge: non-blocking; reads initial status from storage
    // and listens for driveSyncStatusChanged (dispatched by initSettingsBridge).
    initDriveSyncBadge().catch(err => console.warn('[sync] badge init failed:', err));
    await tagManager.initTags(); // Load bookmark tags before command palette / tools UI
    // Prune orphaned bookmarkTags entries (bookmarks deleted while we weren't
    // watching). 時機(ISSUE-162 B6):暖啟動時 cache 是上個 session 的快照、
    // 真正的 rebuild 在背景跑 — 立刻 prune 會拿陳舊快照誤刪「仍然存在的
    // 書籤」的 tag 綁定且無法復原。一律等 bookmarkCacheReady(暖啟動)
    // 或冷啟動已 await 完成的 cache。
    if (state.isBookmarkCacheInitialized() && !pendingWarmCacheRebuild) {
        tagManager.pruneOrphanedBookmarkTags(state.getBookmarkCache() || [])
            .catch(err => console.warn('[tags] prune failed:', err));
    } else {
        document.addEventListener('bookmarkCacheReady', () => {
            tagManager.pruneOrphanedBookmarkTags(state.getBookmarkCache() || [])
                .catch(err => console.warn('[tags] prune failed:', err));
        }, { once: true });
    }
    // Parallelize the two independent storage reads (sync + local) so the
    // total init time doesn't lengthen the critical path before refreshBookmarks
    // settles — CI puppeteer tests were sensitive to even small init delays.
    await Promise.all([
        state.initReadingListSummary(),
        readingListSummaryStore.initSummaries(),
    ]);
    initSummaryRecorder();
    document.addEventListener('readingListSummaryAdded', () => refreshReadingList());
    // Pick up summaries written by other open sidepanels.
    readingListSummaryStore.subscribeToChanges(() => refreshReadingList());
    // Drop summaries for URLs no longer in the Reading List. Run after a real
    // entries fetch (empty list could mean "really empty" OR "fetch failed";
    // the store guards against the latter case internally).
    readingListManager.getAllEntries()
        .then(entries => readingListSummaryStore.pruneOrphans(entries.map(e => e.url)))
        .catch(err => console.warn('[rlSummary] prune failed:', err));
    const bookmarkToolsBtn = document.getElementById('bookmark-tools-btn');
    if (bookmarkToolsBtn) {
        // Mirror the workspace-switch-btn pattern: resolve aria-label at runtime
        // instead of hard-coding English in the markup so it tracks UI language.
        const bmToolsLabel = api.getMessage('bmToolsTitle') || 'Bookmark Tools';
        bookmarkToolsBtn.setAttribute('aria-label', bmToolsLabel);
        bookmarkToolsBtn.addEventListener('click', () => openBookmarkToolsDialog('tags'));
    }
    // 初始化完成、按鈕已接線:開放消費並處理本次開啟時已存在的轉送動作。
    panelReady = true;
    consumePendingPanelAction();

    // Keep multiple open sidepanels in sync: linkedTabs affects bookmark icons,
    // windowNames affects the "Other Windows" section labels.
    state.subscribeToStorageChanges({
        onLinkedTabsChanged: refreshBookmarks,
        onWindowNamesChanged: updateTabList,
    });

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
    // Debounced functions to prevent excessive calls during rapid events
    const debouncedUpdateTabList = debounce(updateTabList, 250);
    const debouncedRefreshBookmarks = debounce(refreshBookmarks, 250);
    const debouncedBuildBookmarkCache = debounce(state.buildBookmarkCache, 250);

    chrome.tabs.onCreated.addListener(updateTabList);
    chrome.tabs.onActivated.addListener(updateTabList);
    chrome.tabs.onMoved.addListener(updateTabList);
    chrome.tabs.onAttached.addListener(updateTabList);
    chrome.tabs.onDetached.addListener(updateTabList);

    // onRemoved can fire rapidly when closing multiple tabs
    chrome.tabs.onRemoved.addListener(async (tabId) => {
        await state.removeLinkedTabByTabId(tabId);
        hoverSummarize.removeFromCache(tabId); // Clean up hover summarize cache
        debouncedUpdateTabList();
        debouncedRefreshBookmarks(); // Refresh bookmarks to update icon state
    });

    // onUpdated fires frequently during page loads (title, favicon, loading status changes)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (changeInfo.url) {
            hoverSummarize.invalidateCache(tabId); // Clear stale summary on URL change
        }
        debouncedUpdateTabList();
        debouncedRefreshBookmarks(); // Refresh bookmarks to update icon state
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

    // Bookmark events - use debounced versions as they can fire rapidly during import/batch operations
    chrome.bookmarks.onRemoved.addListener((id) => {
        state.removeLinksByBookmarkId(id);
        debouncedBuildBookmarkCache(); // Rebuild cache on bookmark removal
        debouncedRefreshBookmarks();
    });

    chrome.bookmarks.onChanged.addListener((id) => {
        //state.removeLinksByBookmarkId(id);
        debouncedBuildBookmarkCache(); // Rebuild cache on bookmark change
        debouncedRefreshBookmarks();
    });

    chrome.bookmarks.onCreated.addListener(() => {
        debouncedBuildBookmarkCache(); // Rebuild cache on bookmark creation
        debouncedRefreshBookmarks();
    });
    chrome.bookmarks.onMoved.addListener(() => {
        debouncedBuildBookmarkCache(); // Rebuild cache on bookmark move
        debouncedRefreshBookmarks();
    });

    // Reading List events
    if (chrome.readingList && chrome.readingList.onEntryAdded) {
        const debouncedRefreshReadingList = debounce(refreshReadingList, 250);
        chrome.readingList.onEntryAdded.addListener(debouncedRefreshReadingList);
        chrome.readingList.onEntryRemoved.addListener(debouncedRefreshReadingList);
        chrome.readingList.onEntryUpdated.addListener(debouncedRefreshReadingList);
    }

    // Reading List visibility toggle from settings
    document.addEventListener('readingListVisibilityChanged', (e) => {
        applyReadingListVisibility(e.detail.visible);
    });

    // Listen for manual RSS fetch updates
    document.addEventListener('readingListUpdated', () => {
        refreshReadingList();
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

    const clearSearch = () => {
        ui.searchBox.value = '';
        ui.clearSearchBtn.classList.add('hidden');
        ui.searchBox.focus();
        search.handleSearch(); // 觸發搜尋以重置顯示
    };

    // 清除按鈕事件
    ui.clearSearchBtn.addEventListener('click', clearSearch);

    if (ui.clearSearchCtaBtn) {
        ui.clearSearchCtaBtn.addEventListener('click', clearSearch);
    }

    // 監聽搜尋結果更新事件
    document.addEventListener('searchResultUpdated', (e) => {
        ui.updateSearchResultCount(e.detail.tabCount, e.detail.bookmarkCount);
    });
}

// --- 啟動 ---
document.addEventListener('DOMContentLoaded', initialize);
