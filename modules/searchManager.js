import * as ui from './uiManager.js';
import * as state from './stateManager.js';
import * as api from './apiManager.js';
import { getTabCache, getTabElementsCache, getGroupHeaderElementsCache } from './ui/tabRenderer.js';
import { getOtherTabCache, getOtherTabElementsCache, getOtherGroupHeaderElementsCache, getOtherWindowFolderElementsCache } from './ui/otherWindowRenderer.js';
import { highlightText, escapeRegExp } from './utils/textUtils.js';
import { debounce } from './utils/functionUtils.js';

// 主搜尋處理函式
async function handleSearch() {
    const query = ui.searchBox.value.trim();

    // 將查詢字串分割成多個關鍵字（空白分隔）
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);

    // 預先編譯所有正則表達式，避免在迴圈中重複編譯
    let regexes = [];
    if (keywords.length > 0) {
        regexes = keywords.map(keyword => new RegExp(`(${escapeRegExp(keyword)})`, 'gi'));
    }

    // 過濾分頁、閱讀清單和書籤
    const tabCount = filterTabsAndGroups(keywords);
    const otherWindowsTabCount = filterOtherWindowsTabs(keywords);
    const readingListCount = filterReadingList(keywords, regexes);
    const bookmarkCount = await filterBookmarks(keywords, regexes);

    // 高亮匹配文字
    if (keywords.length > 0) {
        highlightMatches(regexes);
    } else {
        clearHighlights();
    }

    // 發送結果計數事件 (include other windows tabs and reading list in count)
    const event = new CustomEvent('searchResultUpdated', {
        detail: { tabCount: tabCount + otherWindowsTabCount + readingListCount, bookmarkCount }
    });
    document.dispatchEvent(event);
}

// 多關鍵字匹配檢查（OR 邏輯）
function matchesAnyKeyword(text, keywords) {
    // 防禦性檢查：如果 keywords 不是陣列，轉換為陣列
    // 確保 keywords 始終是一個字串陣列
    let processedKeywords = [];
    if (Array.isArray(keywords)) {
        processedKeywords = keywords.filter(k => typeof k === 'string' && k.length > 0);
    } else if (typeof keywords === 'string') {
        processedKeywords = keywords.split(/\s+/).filter(k => k.length > 0);
    } else {
        // 如果 keywords 既不是陣列也不是字串，則視為沒有關鍵字，所有項目都匹配
        return true;
    }

    if (processedKeywords.length === 0) return true;
    const lowerText = text.toLowerCase();
    return processedKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// 從 URL 提取 domain
function extractDomain(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        // 如果不是有效的 URL，嘗試用正則提取 domain
        const match = url.match(/^(?:https?:\/\/)?([^\/:?#]+)/);
        return match ? match[1] : '';
    }
}

// --- Shared Filter Helpers ---

/**
 * 過濾單一 tab item 並設置匹配狀態
 * @param {HTMLElement} item - Tab DOM 元素
 * @param {Object} tab - Tab 資料 (from cache)
 * @param {string[]} keywords - 搜尋關鍵字
 * @returns {{matches: boolean, groupId: number|undefined}} 匹配結果
 */
function filterTabItem(item, tab, keywords) {
    let title, url, groupId;
    if (tab) {
        title = tab.title;
        url = tab.url;
        groupId = tab.groupId;
    } else {
        // Fallback to DOM if not in cache
        const titleElement = item._refs ? item._refs.title : item.querySelector('.tab-title');
        title = titleElement ? titleElement.textContent : '';
        url = item.dataset.url || '';
        if (item.dataset.groupId) {
            groupId = parseInt(item.dataset.groupId);
        }
    }

    const domain = extractDomain(url);
    const titleMatches = matchesAnyKeyword(title, keywords);
    const urlMatches = matchesAnyKeyword(domain, keywords);
    const matches = titleMatches || urlMatches;

    item.classList.toggle('hidden', !matches);

    // 標記是否為 URL 匹配，稍後用於顯示 domain
    if (urlMatches && !titleMatches) {
        item.dataset.urlMatch = 'true';
        item.dataset.matchedDomain = domain;
    } else {
        delete item.dataset.urlMatch;
        delete item.dataset.matchedDomain;
    }

    return { matches, groupId };
}

/**
 * 更新群組 header 的可見性與展開/收合狀態
 * @param {HTMLElement} header - Group header 元素
 * @param {HTMLElement} content - Group content 元素
 * @param {number} visibleTabsCount - 可見 tab 數量
 * @param {string[]} keywords - 搜尋關鍵字
 */
function updateGroupVisibility(header, content, visibleTabsCount, keywords) {
    const titleElement = header.querySelector('.tab-group-title');
    const title = titleElement ? titleElement.textContent : '';
    const groupTitleMatches = matchesAnyKeyword(title, keywords);
    const hasVisibleChildren = visibleTabsCount > 0;

    header.classList.toggle('hidden', !hasVisibleChildren && !groupTitleMatches);

    const arrow = header.querySelector('.tab-group-arrow');
    if ((hasVisibleChildren || groupTitleMatches) && keywords.length > 0) {
        // 搜尋時展開群組（需使用 inline style 以覆蓋 tabRenderer 設定的 style.display）
        content.style.display = 'block';
        if (arrow) arrow.textContent = '▼';
    } else if (keywords.length === 0) {
        // 無搜尋時恢復原狀態
        const isCollapsed = header.dataset.collapsed === 'true';
        content.style.display = isCollapsed ? 'none' : 'block';
        if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
    }
}

// 過濾分頁和群組，回傳可見分頁數量
function filterTabsAndGroups(keywords) {
    const tabElements = getTabElementsCache();
    const groupHeaderElements = getGroupHeaderElementsCache();
    const tabsCache = getTabCache();
    const groupVisibility = new Map();

    let visibleCount = 0;

    for (const [tabId, item] of tabElements) {
        const tab = tabsCache.get(tabId);
        const { matches, groupId } = filterTabItem(item, tab, keywords);

        if (matches) {
            visibleCount++;
            if (groupId > 0) {
                groupVisibility.set(groupId, (groupVisibility.get(groupId) || 0) + 1);
            }
        }
    }

    for (const [groupId, header] of groupHeaderElements) {
        const content = header.nextElementSibling;
        const visibleTabsCount = groupVisibility.get(groupId) || 0;
        updateGroupVisibility(header, content, visibleTabsCount, keywords);
    }

    return visibleCount;
}

// 過濾其他視窗的分頁（使用共用 filter helpers，優化版本使用快取迭代）
function filterOtherWindowsTabs(keywords) {
    const list = document.getElementById('other-windows-list');
    if (!list) return 0;

    const otherTabsCache = getOtherTabCache();
    const otherTabElements = getOtherTabElementsCache();

    // 追蹤可見性計數：ID -> 可見分頁數量
    const visibleWindowCounts = new Map();
    const visibleGroupCounts = new Map();
    let totalVisibleTabs = 0;

    // 1. 使用快取高效過濾分頁（避免巢狀 DOM 查詢）
    for (const [tabId, item] of otherTabElements) {
        const tab = otherTabsCache.get(tabId);
        // 即使 cache miss，filterTabItem 內有 fallback 邏輯從 DOM 讀取資料
        const { matches } = filterTabItem(item, tab, keywords);

        if (matches) {
            totalVisibleTabs++;
            // 從 DOM dataset 取得 windowId，確保與 DOM 結構同步
            const itemWindowId = item.closest('.folder-content')?.previousElementSibling?.dataset?.windowId;
            if (itemWindowId) {
                const wId = parseInt(itemWindowId, 10);
                if (!isNaN(wId)) {
                    visibleWindowCounts.set(wId, (visibleWindowCounts.get(wId) || 0) + 1);
                }
            }
            // 從 DOM dataset 取得 groupId
            const groupIdStr = item.dataset.groupId;
            if (groupIdStr) {
                const gId = parseInt(groupIdStr, 10);
                if (!isNaN(gId) && gId > 0) {
                    visibleGroupCounts.set(gId, (visibleGroupCounts.get(gId) || 0) + 1);
                }
            }
        }
    }

    // 2. 更新分頁群組 Header（使用 Cache 避免 DOM 查詢）
    const groupHeaders = getOtherGroupHeaderElementsCache();
    for (const [groupId, header] of groupHeaders) {
        const content = header.nextElementSibling;
        if (!content || !content.classList.contains('tab-group-content')) continue;

        const visibleTabsCount = visibleGroupCounts.get(groupId) || 0;
        updateGroupVisibility(header, content, visibleTabsCount, keywords);
    }

    // 3. 更新視窗資料夾（使用 Cache 避免 DOM 查詢）
    const windowFolders = getOtherWindowFolderElementsCache();
    for (const [windowId, folder] of windowFolders) {
        const content = folder.nextElementSibling;
        if (!content || !content.classList.contains('folder-content')) continue;

        const windowCount = visibleWindowCounts.get(windowId) || 0;

        const visible = windowCount > 0 || keywords.length === 0;
        folder.classList.toggle('hidden', !visible);
        content.classList.toggle('hidden', !visible);

        // 展開/收合（統一使用 CSS class 控制，避免 inline style 衝突）
        const icon = folder.querySelector('.window-icon');
        if (windowCount > 0 && keywords.length > 0) {
            // 有搜尋結果時：展開並顯示
            content.classList.remove('collapsed');
            if (icon) icon.textContent = '▼';
            folder.setAttribute('aria-expanded', 'true');
        } else if (keywords.length === 0) {
            // 清除搜尋時：收合
            content.classList.add('collapsed');
            if (icon) icon.textContent = '▶';
            folder.setAttribute('aria-expanded', 'false');
        }
    }

    return totalVisibleTabs;
}

/**
 * 過濾閱讀清單項目，回傳可見項目數量
 * @param {string[]} keywords - 搜尋關鍵字
 * @param {RegExp[]} regexes - 預編譯的正則表達式（用於高亮）
 * @returns {number} 可見閱讀清單項目數量
 */
function filterReadingList(keywords, regexes = []) {
    const container = document.getElementById('reading-list');
    if (!container) return 0;

    const items = container.querySelectorAll('.reading-list-item');
    if (items.length === 0) return 0;

    let visibleCount = 0;

    items.forEach(item => {
        const title = item.dataset.title || '';
        const url = item.dataset.url || '';
        const domain = extractDomain(url);

        const titleMatches = matchesAnyKeyword(title, keywords);
        const urlMatches = matchesAnyKeyword(domain, keywords);
        const matches = keywords.length === 0 || titleMatches || urlMatches;

        item.classList.toggle('hidden', !matches);

        if (matches && keywords.length > 0) {
            visibleCount++;

            // 高亮標題
            const titleEl = item.querySelector('.reading-list-title');
            if (titleEl && regexes.length > 0) {
                const originalTitle = titleEl.dataset.originalText || titleEl.textContent;
                const highlightedTitle = highlightText(originalTitle, regexes, 'title');
                if (highlightedTitle !== originalTitle) {
                    titleEl.innerHTML = highlightedTitle;
                    if (!titleEl.dataset.originalText) {
                        titleEl.dataset.originalText = originalTitle;
                    }
                }
            }

            // 如果是 URL 匹配（非標題匹配），顯示高亮的 domain
            if (urlMatches && !titleMatches && domain) {
                // 先移除舊的 domain 顯示（如果有）
                const existingDomain = item.querySelector('.matched-domain');
                if (existingDomain) {
                    existingDomain.remove();
                }

                // 建立 domain 顯示元素
                const domainElement = document.createElement('div');
                domainElement.className = 'matched-domain';
                const highlightedDomain = highlightText(domain, regexes, 'url');
                domainElement.innerHTML = highlightedDomain + '...';

                // 附加到 content wrapper
                const contentWrapper = item.querySelector('.reading-list-content');
                if (contentWrapper) {
                    contentWrapper.appendChild(domainElement);
                }
            } else {
                // 標題匹配時，移除可能存在的 domain 顯示
                const existingDomain = item.querySelector('.matched-domain');
                if (existingDomain) {
                    existingDomain.remove();
                }
            }
        } else if (keywords.length === 0) {
            // 清除高亮（無搜尋時）
            const titleEl = item.querySelector('.reading-list-title');
            if (titleEl && titleEl.dataset.originalText) {
                titleEl.textContent = titleEl.dataset.originalText;
                delete titleEl.dataset.originalText;
            }

            // 移除 domain 顯示
            const existingDomain = item.querySelector('.matched-domain');
            if (existingDomain) {
                existingDomain.remove();
            }
        }
    });

    // 處理閱讀清單區塊的展開/收合
    const section = document.getElementById('reading-list-section');
    const toggleBtn = document.getElementById('reading-list-toggle');

    if (section) {
        if (keywords.length > 0 && visibleCount > 0) {
            // 有搜尋結果時展開
            container.classList.remove('collapsed');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        } else if (keywords.length === 0) {
            // 清除搜尋時，恢復使用者偏好的收合狀態
            // 不做任何事，讓使用者的原有設定維持
        }
    }

    return visibleCount;
}

// Search state to track if we are currently showing filtered results
let isFiltering = false;

// Search generation counter to prevent stale async results from overwriting newer ones.
// Race condition: filterBookmarks(["test"]) awaits getBookmarkTree(), during which the user
// clears search → filterBookmarks([]) fires refreshBookmarksRequired → full tree re-renders.
// Without this guard, the stale filterBookmarks(["test"]) resolves and overwrites the full tree.
let bookmarkSearchGeneration = 0;

// 過濾書籤，回傳可見書籤數量 (使用 Cache 進行搜尋)
async function filterBookmarks(keywords, regexes = []) {
    // Increment generation for every call; capture it to detect staleness after await
    const thisGeneration = ++bookmarkSearchGeneration;

    // 如果沒有關鍵字，直接返回（不重新渲染）
    // 書籤已經在 refreshBookmarks 中渲染好了
    // 如果沒有關鍵字，檢查是否需要重置視圖
    if (keywords.length === 0) {
        if (isFiltering) {
            // 從過濾狀態變為無過濾狀態（使用者清除了搜尋）
            isFiltering = false;
            // 請求完整重新渲染以恢復書籤樹的原始狀態
            document.dispatchEvent(new CustomEvent('refreshBookmarksRequired'));
        }
        // 無論是否剛剛重置，如果是空字串，我們都不進行過濾渲染，直接回傳 0
        // (如果是剛重置，refreshBookmarks 會處理重新渲染)
        // (如果是初始化，預設就是完整視圖)
        return 0;
    }

    // 標記目前正在進行過濾
    isFiltering = true;

    // 從 cache 中搜尋匹配的書籤
    const cache = state.getBookmarkCache();
    if (!cache || cache.length === 0) {
        return 0;
    }

    // 找出所有匹配的書籤項目（只搜尋書籤，不搜尋資料夾名稱）
    const matchingItems = cache.filter(item => {
        if (item.type !== 'bookmark') return false;
        const titleMatches = matchesAnyKeyword(item.title, keywords);
        const urlMatches = matchesAnyKeyword(extractDomain(item.url), keywords);
        // 記錄匹配類型
        item._titleMatches = titleMatches;
        item._urlMatches = urlMatches;
        return titleMatches || urlMatches;
    });

    if (matchingItems.length === 0) {
        // 清空書籤列表，顯示無結果
        if (thisGeneration === bookmarkSearchGeneration) {
            ui.bookmarkListContainer.innerHTML = '';
        }
        return 0;
    }

    // 收集所有需要顯示的節點 ID（匹配項目 + 所有祖先資料夾）
    const visibleIds = new Set();
    const cacheMap = new Map(cache.map(item => [item.id, item]));

    for (const item of matchingItems) {
        visibleIds.add(item.id);
        // 遞迴向上收集所有祖先
        let parentId = item.parentId;
        while (parentId && cacheMap.has(parentId)) {
            visibleIds.add(parentId);
            const parent = cacheMap.get(parentId);
            parentId = parent.parentId;
        }
    }

    // 從快取或 Chrome API 取得完整書籤樹，然後過濾
    let tree = state.getBookmarkTreeFromCache();
    if (!tree) {
        tree = await api.getBookmarkTree();
    }

    // After await: check if a newer search has been initiated. If so, discard this stale result.
    if (thisGeneration !== bookmarkSearchGeneration) {
        return 0;
    }

    if (!tree[0] || !tree[0].children) return 0;

    // 過濾樹：只保留 visibleIds 中的節點
    const filteredTree = filterTreeByIds(tree[0].children, visibleIds);

    // 重新渲染過濾後的書籤樹（強制展開所有資料夾），並傳入 regexes 用於高亮
    ui.bookmarkListContainer.innerHTML = '';
    ui.renderBookmarks(filteredTree, ui.bookmarkListContainer, '1', () => {
        document.dispatchEvent(new CustomEvent('refreshBookmarksRequired'));
    }, { forceExpandAll: true, highlightRegexes: regexes });

    return matchingItems.length;
}

// 根據 ID 集合過濾樹狀結構
function filterTreeByIds(nodes, visibleIds) {
    const result = [];
    for (const node of nodes) {
        if (!visibleIds.has(node.id)) continue;

        if (node.children) {
            // 資料夾：遞迴過濾子節點
            const filteredChildren = filterTreeByIds(node.children, visibleIds);
            result.push({
                ...node,
                children: filteredChildren
            });
        } else {
            // 書籤項目
            result.push({ ...node });
        }
    }
    return result;
}



// 高亮匹配的文字
function highlightMatches(regexes) {

    // 高亮分頁標題（包含其他視窗）
    // Optimization: Iterate over cached elements instead of querySelectorAll
    const tabElements = getTabElementsCache();
    const otherTabElements = getOtherTabElementsCache();

    const highlightTabItem = (item) => {
        // Skip hidden items
        if (item.classList.contains('hidden')) return;

        const titleElement = item._refs ? item._refs.title : item.querySelector('.tab-title');
        const isUrlMatch = item.dataset.urlMatch === 'true';
        const matchedDomain = item.dataset.matchedDomain;

        if (titleElement) {
            // Check if we already have original text stored (to avoid double escaping or loss of original)
            // If it's already highlighted, we should start from original text
            const originalTitle = titleElement.dataset.originalText || titleElement.textContent;

            const highlightedTitle = highlightText(originalTitle, regexes, 'title');

            // 只在有高亮時才更新 DOM
            if (highlightedTitle !== originalTitle) {
                titleElement.innerHTML = highlightedTitle;
                if (!titleElement.dataset.originalText) {
                    titleElement.dataset.originalText = originalTitle;
                }
            }

            // 如果是 URL 匹配，顯示 domain
            if (isUrlMatch && matchedDomain) {
                // 移除舊的 domain 顯示（如果有）
                const existingDomain = item.querySelector('.matched-domain');
                if (existingDomain) {
                    existingDomain.remove();
                }

                // 建立 domain 顯示元素
                const domainElement = document.createElement('div');
                domainElement.className = 'matched-domain';
                const highlightedDomain = highlightText(matchedDomain, regexes, 'url');
                domainElement.innerHTML = highlightedDomain + '...';

                // 附加到 titleWrapper
                const titleWrapper = item._refs ? item._refs.titleWrapper : item.querySelector('.tab-content-wrapper');
                if (titleWrapper) {
                    titleWrapper.appendChild(domainElement);
                }
            }
        }
    };

    for (const item of tabElements.values()) {
        highlightTabItem(item);
    }

    for (const item of otherTabElements.values()) {
        highlightTabItem(item);
    }

    // 書籤高亮部分已移除，改為在 renderBookmarks 中處理
}

// 清除所有高亮
function clearHighlights() {
    // 清除分頁高亮（包含其他視窗）
    // Optimization: Use caches to clear highlights
    const tabElements = getTabElementsCache();
    const otherTabElements = getOtherTabElementsCache();

    const clearTabItem = (item) => {
        const titleElement = item._refs ? item._refs.title : item.querySelector('.tab-title');
        if (titleElement && titleElement.dataset.originalText) {
            titleElement.textContent = titleElement.dataset.originalText;
            delete titleElement.dataset.originalText;
        }

        const domainElement = item.querySelector('.matched-domain');
        if (domainElement) {
            domainElement.remove();
        }
    };

    for (const item of tabElements.values()) {
        clearTabItem(item);
    }

    for (const item of otherTabElements.values()) {
        clearTabItem(item);
    }

    // 書籤高亮清除部分已移除，因為搜尋結束後會重新渲染書籤列表
}


// 使用 debounce 包裝的搜尋函式
const debouncedSearch = debounce(() => {
    handleSearch();
}, 300);

function initialize() {
    ui.searchBox.addEventListener('input', () => {
        if (ui.searchBox.value.trim().length > 0) {
            ui.setSearchLoading(true);
        }
        debouncedSearch();
    });
}

export { initialize, handleSearch, filterTabsAndGroups, filterBookmarks };
