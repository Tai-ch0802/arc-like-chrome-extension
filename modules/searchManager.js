import * as ui from './uiManager.js';
import * as state from './stateManager.js';
import * as api from './apiManager.js';
import { getTabCache, getTabElementsCache, getGroupHeaderElementsCache } from './ui/tabRenderer.js';
import { getOtherTabCache, getOtherTabElementsCache } from './ui/otherWindowRenderer.js';
import { highlightText, escapeRegExp } from './utils/textUtils.js';

// Debounce 工具函式：延遲執行，避免頻繁觸發
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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

    // 過濾分頁和書籤
    const tabCount = filterTabsAndGroups(keywords);
    const otherWindowsTabCount = filterOtherWindowsTabs(keywords);
    const bookmarkCount = await filterBookmarks(keywords, regexes);

    // 高亮匹配文字
    if (keywords.length > 0) {
        highlightMatches(regexes);
    } else {
        clearHighlights();
    }

    // 發送結果計數事件 (include other windows tabs in count)
    const event = new CustomEvent('searchResultUpdated', {
        detail: { tabCount: tabCount + otherWindowsTabCount, bookmarkCount }
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

// 過濾分頁和群組，回傳可見分頁數量
function filterTabsAndGroups(keywords) {
    // Optimization: Use DOM element cache to avoid repeated querySelectorAll and DOM reads
    const tabElements = getTabElementsCache();
    // Optimization: Use DOM element cache for group headers
    const groupHeaderElements = getGroupHeaderElementsCache();

    let visibleCount = 0;

    // Optimization: Use cache to avoid DOM reads
    const tabsCache = getTabCache();
    // Optimization: Track group visibility to avoid querying DOM in group loop
    const groupVisibility = new Map();

    for (const [tabId, item] of tabElements) {
        // Direct cache access using ID from map key
        const tab = tabsCache.get(tabId);

        let title, url, groupId;
        if (tab) {
            title = tab.title;
            url = tab.url;
            groupId = tab.groupId;
        } else {
            // Fallback to DOM if not in cache (should be rare)
            const titleElement = item.querySelector('.tab-title');
            title = titleElement ? titleElement.textContent : '';
            url = item.dataset.url || '';
            // Try to get groupId from dataset (added in tabRenderer)
            if (item.dataset.groupId) {
                groupId = parseInt(item.dataset.groupId);
            }
        }

        const domain = extractDomain(url);

        // OR 邏輯：標題或 domain 匹配任一關鍵字即可
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

        if (matches) {
            visibleCount++;
            if (groupId > 0) {
                groupVisibility.set(groupId, (groupVisibility.get(groupId) || 0) + 1);
            }
        }
    }

    for (const [groupId, header] of groupHeaderElements) {
        const content = header.nextElementSibling;

        // Group ID is available from map key
        const visibleTabsCount = groupVisibility.get(groupId) || 0;

        const titleElement = header.querySelector('.tab-group-title');
        const title = titleElement ? titleElement.textContent : '';
        const groupTitleMatches = matchesAnyKeyword(title, keywords);
        const hasVisibleChildren = visibleTabsCount > 0;

        header.classList.toggle('hidden', !hasVisibleChildren && !groupTitleMatches);

        if ((hasVisibleChildren || groupTitleMatches) && keywords.length > 0) {
            content.style.display = 'block';
            header.querySelector('.tab-group-arrow').textContent = '▼';
        } else if (keywords.length === 0) {
            const isCollapsed = header.dataset.collapsed === 'true';
            content.style.display = isCollapsed ? 'none' : 'block';
            header.querySelector('.tab-group-arrow').textContent = isCollapsed ? '▶' : '▼';
        }
    }

    return visibleCount;
}

// 過濾其他視窗的分頁（與 filterTabsAndGroups 相同邏輯）
function filterOtherWindowsTabs(keywords) {
    const list = document.getElementById('other-windows-list');
    if (!list) return 0;

    let totalCount = 0;

    // Optimization: Iterate over cached elements instead of querySelectorAll
    const otherTabElements = getOtherTabElementsCache();
    const otherTabsCache = getOtherTabCache();

    // Track counts to update container visibility
    const windowCounts = new Map();
    const groupCounts = new Map();

    for (const [tabId, item] of otherTabElements) {
        const tab = otherTabsCache.get(tabId);
        let title, url, groupId, windowId;

        if (tab) {
            title = tab.title;
            url = tab.url;
            groupId = tab.groupId;
            windowId = tab.windowId;
        } else {
            // Fallback to DOM if not in cache (should be rare)
            const titleElement = item.querySelector('.tab-title');
            title = titleElement ? titleElement.textContent : '';
            url = item.dataset.url || '';
            if (item.dataset.groupId) {
                groupId = parseInt(item.dataset.groupId);
            }
            // Try to find windowId from DOM structure if missing from cache
            const folderContent = item.closest('.folder-content');
            if (folderContent) {
                const folder = folderContent.previousElementSibling;
                if (folder && folder.dataset.windowId) {
                    windowId = parseInt(folder.dataset.windowId);
                }
            }
        }

        const domain = extractDomain(url);
        const titleMatches = matchesAnyKeyword(title, keywords);
        const urlMatches = matchesAnyKeyword(domain, keywords);
        const matches = titleMatches || urlMatches;

        item.classList.toggle('hidden', !matches);

        if (urlMatches && !titleMatches) {
            item.dataset.urlMatch = 'true';
            item.dataset.matchedDomain = domain;
        } else {
            delete item.dataset.urlMatch;
            delete item.dataset.matchedDomain;
        }

        if (matches) {
            totalCount++;
            if (windowId) {
                windowCounts.set(windowId, (windowCounts.get(windowId) || 0) + 1);
            }
            if (groupId > 0) {
                groupCounts.set(groupId, (groupCounts.get(groupId) || 0) + 1);
            }
        }
    }

    // Update window folders and group headers visibility
    const folders = list.querySelectorAll('.window-folder');
    folders.forEach(folder => {
        const windowId = parseInt(folder.dataset.windowId);
        const windowCount = windowCounts.get(windowId) || 0;
        const visible = windowCount > 0 || keywords.length === 0;

        folder.classList.toggle('hidden', !visible);
        const content = folder.nextElementSibling;

        if (content && content.classList.contains('folder-content')) {
            content.classList.toggle('hidden', !visible);

            // Expand/collapse based on search results
            const icon = folder.querySelector('.window-icon');
            if (windowCount > 0 && keywords.length > 0) {
                content.style.display = 'block';
                if (icon) icon.textContent = '▼';
            } else if (keywords.length === 0) {
                content.style.display = 'none';
                if (icon) icon.textContent = '▶';
            }

            // Update group headers within this window
            // We still query headers here, but this is much lighter than querying all tabs
            const groupHeaders = content.querySelectorAll('.tab-group-header');
            groupHeaders.forEach(header => {
                const groupId = parseInt(header.dataset.groupId);
                const visibleTabsCount = groupCounts.get(groupId) || 0;

                const groupContent = header.nextElementSibling;
                if (!groupContent || !groupContent.classList.contains('tab-group-content')) return;

                const titleElement = header.querySelector('.tab-group-title');
                const title = titleElement ? titleElement.textContent : '';
                const groupTitleMatches = matchesAnyKeyword(title, keywords);
                const hasVisibleChildren = visibleTabsCount > 0;

                header.classList.toggle('hidden', !hasVisibleChildren && !groupTitleMatches);

                if ((hasVisibleChildren || groupTitleMatches) && keywords.length > 0) {
                    groupContent.style.display = 'block';
                    header.querySelector('.tab-group-arrow').textContent = '▼';
                } else if (keywords.length === 0) {
                    const isCollapsed = header.dataset.collapsed === 'true';
                    groupContent.style.display = isCollapsed ? 'none' : 'block';
                    header.querySelector('.tab-group-arrow').textContent = isCollapsed ? '▶' : '▼';
                }
            });
        }
    });

    return totalCount;
}

// Search state to track if we are currently showing filtered results
let isFiltering = false;

// 過濾書籤，回傳可見書籤數量 (使用 Cache 進行搜尋)
async function filterBookmarks(keywords, regexes = []) {
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
        ui.bookmarkListContainer.innerHTML = '';
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
    if (!tree[0] || !tree[0].children) return 0;

    // 過濾樹：只保留 visibleIds 中的節點
    const filteredTree = filterTreeByIds(tree[0].children, visibleIds);

    // 重新渲染過濾後的書籤樹（強制展開所有資料夾），並傳入 regexes 用於高亮
    ui.bookmarkListContainer.innerHTML = '';
    ui.renderBookmarks(filteredTree, ui.bookmarkListContainer, '1', () => {
        document.dispatchEvent(new CustomEvent('refreshBookmarksRequired'));
    }, { forceExpandAll: true, highlightRegexes: regexes });

    // 確保所有資料夾視覺上是展開狀態
    const allFolderContents = ui.bookmarkListContainer.querySelectorAll('.folder-content');
    allFolderContents.forEach(content => {
        content.style.display = 'block';
        const folderIcon = content.previousElementSibling?.querySelector('.bookmark-icon');
        if (folderIcon) folderIcon.textContent = '▼';
    });

    // 設定 URL 匹配的 dataset 以供 renderBookmarks (如果將來需要) 或其他邏輯使用
    // 注意：因為現在高亮是在渲染時直接做的，這裡可能不需要再設定 dataset.urlMatch 給高亮函數用了，
    // 但也許還有其他用途，先保留，但 matchedDomain 其實已經在高亮邏輯中處理了。
    // 實際上，如果 renderBookmarks 處理了高亮和 domain 顯示，這裡的 loop 可能可以簡化或移除。
    // 但為了保持資料一致性，保留無妨。

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

// 遞迴計算書籤可見性 (used by something else? filterTreeByIds replaces this logic inside search?
// No, filterTreeByIds is used. calculateBookmarkVisibility and applyBookmarkVisibility seem unused in current active path
// since we use filterTreeByIds + renderBookmarks.
// Wait, looking at original code, applyBookmarkVisibility was exported but unused in handleSearch?
// No, filterBookmarks was using filterTreeByIds. calculate/applyBookmarkVisibility seem to be legacy or helper functions not used in the main flow
// inside filterBookmarks which uses reconstruction.
// I will leave them as is to avoid breaking anything unexpected.)
function calculateBookmarkVisibility(node, keywords, visibleItems) {
    const titleElement = node.querySelector('.bookmark-title');
    if (!titleElement) return false;

    const title = titleElement.textContent;
    let url = '';

    // 如果是書籤項目，取得 URL 和 domain
    if (node.classList.contains('bookmark-item')) {
        url = node.title.split('\n')[1] || ''; // URL 在 tooltip 的第二行
    }
    const domain = extractDomain(url);

    // 檢查標題或 domain 是否匹配
    const titleMatches = matchesAnyKeyword(title, keywords);
    const urlMatches = matchesAnyKeyword(domain, keywords);
    const selfMatches = titleMatches || urlMatches;

    // 標記是否為 URL 匹配
    if (urlMatches && !titleMatches) {
        node.dataset.urlMatch = 'true';
        node.dataset.matchedDomain = domain;
    } else {
        delete node.dataset.urlMatch;
        delete node.dataset.matchedDomain;
    }

    let hasVisibleChild = false;
    if (node.classList.contains('bookmark-folder')) {
        const content = node.nextElementSibling;
        if (content && content.classList.contains('folder-content')) {
            for (const child of content.children) {
                if (calculateBookmarkVisibility(child, keywords, visibleItems)) {
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

// 套用書籤可見性，回傳可見書籤數量
function applyBookmarkVisibility(keywords, visibleItems) {
    const allItems = ui.bookmarkListContainer.querySelectorAll('.bookmark-item, .bookmark-folder');
    let visibleCount = 0;

    allItems.forEach(node => {
        const isVisible = visibleItems.has(node);
        node.classList.toggle('hidden', !isVisible);

        // 只計算書籤項目，不含資料夾
        if (isVisible && node.classList.contains('bookmark-item')) {
            visibleCount++;
        }

        if (node.classList.contains('bookmark-folder')) {
            const content = node.nextElementSibling;
            const icon = node.querySelector('.bookmark-icon');
            if (isVisible && keywords.length > 0) {
                let shouldExpand = false;
                if (content) {
                    for (const child of content.children) {
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

    return visibleCount;
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

        const titleElement = item.querySelector('.tab-title');
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
                const titleWrapper = item.querySelector('.tab-content-wrapper');
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
        const titleElement = item.querySelector('.tab-title');
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
