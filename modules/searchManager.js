import * as ui from './uiManager.js';
import * as state from './stateManager.js';

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
function handleSearch() {
    const query = ui.searchBox.value.trim();

    // 將查詢字串分割成多個關鍵字（空白分隔）
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);

    // 過濾分頁和書籤
    const tabCount = filterTabsAndGroups(keywords);
    const bookmarkCount = filterBookmarks(keywords);

    // 高亮匹配文字
    if (keywords.length > 0) {
        highlightMatches(keywords);
    } else {
        clearHighlights();
    }

    // 發送結果計數事件
    const event = new CustomEvent('searchResultUpdated', {
        detail: { tabCount, bookmarkCount }
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
    const tabItems = document.querySelectorAll('#tab-list .tab-item');
    const groupHeaders = document.querySelectorAll('#tab-list .tab-group-header');
    let visibleCount = 0;

    tabItems.forEach(item => {
        const titleElement = item.querySelector('.tab-title');
        const title = titleElement.textContent;
        const url = item.dataset.url || '';
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

        if (matches) visibleCount++;
    });

    groupHeaders.forEach(header => {
        const content = header.nextElementSibling;
        const visibleTabsInGroup = content.querySelectorAll('.tab-item:not(.hidden)');
        const titleElement = header.querySelector('.tab-group-title');
        const title = titleElement ? titleElement.textContent : '';
        const groupTitleMatches = matchesAnyKeyword(title, keywords);
        const hasVisibleChildren = visibleTabsInGroup.length > 0;

        header.classList.toggle('hidden', !hasVisibleChildren && !groupTitleMatches);

        if ((hasVisibleChildren || groupTitleMatches) && keywords.length > 0) {
            content.style.display = 'block';
            header.querySelector('.tab-group-arrow').textContent = '▼';
        } else if (keywords.length === 0) {
            const isCollapsed = header.dataset.collapsed === 'true';
            content.style.display = isCollapsed ? 'none' : 'block';
            header.querySelector('.tab-group-arrow').textContent = isCollapsed ? '▶' : '▼';
        }
    });

    return visibleCount;
}

// 過濾書籤，回傳可見書籤數量
function filterBookmarks(keywords) {
    const visibleBookmarkNodes = new Set();
    if (ui.bookmarkListContainer.children.length > 0) {
        const topLevelItems = ui.bookmarkListContainer.querySelectorAll(':scope > .bookmark-item, :scope > .bookmark-folder');
        for (const item of topLevelItems) {
            calculateBookmarkVisibility(item, keywords, visibleBookmarkNodes);
        }
    }
    const count = applyBookmarkVisibility(keywords, visibleBookmarkNodes);
    return count;
}

// 遞迴計算書籤可見性
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
function highlightMatches(keywords) {
    // 高亮分頁標題
    const tabItems = document.querySelectorAll('#tab-list .tab-item:not(.hidden)');
    tabItems.forEach(item => {
        const titleElement = item.querySelector('.tab-title');
        const isUrlMatch = item.dataset.urlMatch === 'true';
        const matchedDomain = item.dataset.matchedDomain;

        if (titleElement) {
            const originalTitle = titleElement.textContent;
            const highlightedTitle = highlightText(originalTitle, keywords, 'title');

            // 只在有高亮時才更新 DOM
            if (highlightedTitle !== originalTitle) {
                titleElement.innerHTML = highlightedTitle;
                titleElement.dataset.originalText = originalTitle;
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
                const highlightedDomain = highlightText(matchedDomain, keywords, 'url');
                domainElement.innerHTML = highlightedDomain + '...';

                // 附加到 titleWrapper
                const titleWrapper = item.querySelector('.tab-content-wrapper');
                if (titleWrapper) {
                    titleWrapper.appendChild(domainElement);
                }
            }
        }
    });

    // 高亮書籤標題
    const bookmarkItems = ui.bookmarkListContainer.querySelectorAll('.bookmark-item:not(.hidden), .bookmark-folder:not(.hidden)');
    bookmarkItems.forEach(item => {
        const titleElement = item.querySelector('.bookmark-title');
        const isUrlMatch = item.dataset.urlMatch === 'true';
        const matchedDomain = item.dataset.matchedDomain;

        if (titleElement) {
            const originalTitle = titleElement.textContent;
            const highlightedTitle = highlightText(originalTitle, keywords, 'title');

            if (highlightedTitle !== originalTitle) {
                titleElement.innerHTML = highlightedTitle;
                titleElement.dataset.originalText = originalTitle;
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
                const highlightedDomain = highlightText(matchedDomain, keywords, 'url');
                domainElement.innerHTML = highlightedDomain + '...';

                // 附加到 bookmark-content-wrapper
                const titleWrapper = item.querySelector('.bookmark-content-wrapper');
                if (titleWrapper) {
                    titleWrapper.appendChild(domainElement);
                }
            }
        }
    });
}

// 高亮文字工具函式
function highlightText(text, keywords, type) {
    let result = text;

    // 為每個關鍵字加上高亮
    keywords.forEach(keyword => {
        if (keyword.length === 0) return;

        // 使用正則表達式進行大小寫不敏感的替換
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
        const markClass = type === 'url' ? 'url-match' : 'title-match';
        result = result.replace(regex, `<mark class="${markClass}">$1</mark>`);
    });

    return result;
}

// 轉義正則表達式特殊字元
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 清除所有高亮
function clearHighlights() {
    // 清除分頁高亮
    const tabTitles = document.querySelectorAll('#tab-list .tab-title[data-original-text]');
    tabTitles.forEach(element => {
        element.textContent = element.dataset.originalText;
        delete element.dataset.originalText;
    });

    // 清除分頁的 domain 顯示
    const tabDomains = document.querySelectorAll('#tab-list .matched-domain');
    tabDomains.forEach(element => element.remove());

    // 清除書籤高亮
    const bookmarkTitles = ui.bookmarkListContainer.querySelectorAll('.bookmark-title[data-original-text]');
    bookmarkTitles.forEach(element => {
        element.textContent = element.dataset.originalText;
        delete element.dataset.originalText;
    });

    // 清除書籤的 domain 顯示
    const bookmarkDomains = ui.bookmarkListContainer.querySelectorAll('.matched-domain');
    bookmarkDomains.forEach(element => element.remove());
}

// 鍵盤導航相關變數
let selectedIndex = -1;

// 取得所有可見的導航項目（分頁和書籤）
function getAllVisibleItems() {
    const visibleTabs = Array.from(document.querySelectorAll('#tab-list .tab-item:not(.hidden)'));
    const visibleBookmarks = Array.from(ui.bookmarkListContainer.querySelectorAll('.bookmark-item:not(.hidden)'));
    return [...visibleTabs, ...visibleBookmarks];
}

// 更新選取狀態
function updateSelection(items) {
    // 清除舊的選取
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

    if (selectedIndex >= 0 && selectedIndex < items.length) {
        const selectedItem = items[selectedIndex];
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// 處理鍵盤導航
function handleKeyNavigation(e) {
    const items = getAllVisibleItems();
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex++;
        if (selectedIndex >= items.length) selectedIndex = 0; // 循環到第一個
        updateSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex--;
        if (selectedIndex < 0) selectedIndex = items.length - 1; // 循環到最後一個
        updateSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
            items[selectedIndex].click();
        }
    }
}

// 使用 debounce 包裝的搜尋函式
const debouncedSearch = debounce(() => {
    handleSearch();
    // 搜尋後重置選取狀態
    selectedIndex = -1;
    updateSelection([]);
}, 300);

function initialize() {
    ui.searchBox.addEventListener('input', debouncedSearch);
    ui.searchBox.addEventListener('keydown', handleKeyNavigation);
}

export { initialize, handleSearch, filterTabsAndGroups, filterBookmarks };
