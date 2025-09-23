// --- DOM 元素獲取 ---
const tabListContainer = document.getElementById('tab-list');
const bookmarkListContainer = document.getElementById('bookmark-list');
const searchBox = document.getElementById('search-box');

// --- 搜尋邏輯 (重構) ---
function handleSearch() {
    const query = searchBox.value.toLowerCase().trim();

    // --- 過濾分頁 (邏輯不變) ---
    filterTabsAndGroups(query);

    // --- 全新：過濾書籤的兩步驟流程 ---
    // 步驟 1: 計算哪些書籤節點應該可見
    const visibleBookmarkNodes = new Set();
    if (bookmarkListContainer.children.length > 0) {
        const topLevelItems = bookmarkListContainer.querySelectorAll(':scope > .bookmark-item, :scope > .bookmark-folder');
        for (const item of topLevelItems) {
            calculateBookmarkVisibility(item, query, visibleBookmarkNodes);
        }
    }
    
    // 步驟 2: 根據計算結果，更新畫面
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

// --- 全新：步驟 1 的遞迴計算函式 ---
function calculateBookmarkVisibility(node, query, visibleItems) {
    const titleElement = node.querySelector('.bookmark-title');
    if (!titleElement) return false;

    const title = titleElement.textContent.toLowerCase();
    const selfMatches = query ? title.includes(query) : false;

    if (node.classList.contains('bookmark-folder')) {
        let hasVisibleChild = false;
        const content = node.nextElementSibling;
        if (content) {
            for (const child of content.children) {
                if (calculateBookmarkVisibility(child, query, visibleItems)) {
                    hasVisibleChild = true;
                }
            }
        }
        const shouldBeVisible = selfMatches || hasVisibleChild;
        if (shouldBeVisible) {
            visibleItems.add(node); // 將可見的資料夾加入清單
        }
        return shouldBeVisible;
    } else {
        if (selfMatches) {
            visibleItems.add(node); // 將可見的書籤加入清單
        }
        return selfMatches;
    }
}

// --- 全新：步驟 2 的畫面渲染函式 ---
function applyBookmarkVisibility(query, visibleItems) {
    const allItems = bookmarkListContainer.querySelectorAll('.bookmark-item, .bookmark-folder');
    allItems.forEach(node => {
        const isVisible = visibleItems.has(node);
        node.classList.toggle('hidden', !isVisible);

        if (node.classList.contains('bookmark-folder')) {
            const content = node.nextElementSibling;
            const icon = node.querySelector('.bookmark-icon');
            if (isVisible && query) {
                // 只有在「可見清單」中的資料夾，才需要考慮是否展開
                // 我們透過檢查其子元素是否也在可見清單中來決定
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
                } else { // 資料夾本身匹配，但子項目不匹配
                    content.style.display = 'none';
                    icon.textContent = '▶';
                }
            } else { // 重置狀態
                content.style.display = 'none';
                icon.textContent = '▶';
            }
        }
    });
}


// --- 輔助函式：建立單一分頁的 DOM 元素 ---
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

// --- 重構：處理分頁和分頁群組的函式 ---
async function updateTabList() {
    const [groups, tabs] = await Promise.all([
        chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }),
        chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    ]);
    tabListContainer.innerHTML = ''; 
    const groupsMap = new Map(groups.map(group => [group.id, { ...group, tabs: [] }]));
    const ungroupedTabs = [];
    for (const tab of tabs) {
        if (tab.groupId > 0 && groupsMap.has(tab.groupId)) {
            groupsMap.get(tab.groupId).tabs.push(tab);
        } else {
            ungroupedTabs.push(tab);
        }
    }
    for (const group of groupsMap.values()) {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tab-group-header';
        groupHeader.dataset.collapsed = group.collapsed;
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
        group.tabs.sort((a, b) => a.index - b.index).forEach(tab => {
            const tabElement = createTabElement(tab);
            groupContent.appendChild(tabElement);
        });
        tabListContainer.appendChild(groupContent);
        groupHeader.addEventListener('click', () => {
            const isCollapsed = groupContent.style.display === 'none';
            groupContent.style.display = isCollapsed ? 'block' : 'none';
            arrow.textContent = isCollapsed ? '▼' : '▶';
            chrome.tabGroups.update(group.id, { collapsed: !isCollapsed });
        });
    }
    ungroupedTabs.sort((a, b) => a.index - b.index).forEach(tab => {
        const tabElement = createTabElement(tab);
        tabListContainer.appendChild(tabElement);
    });
    handleSearch();
}

// --- 處理書籤的函式 ---
function renderBookmarks(bookmarkNodes, container) {
    bookmarkNodes.forEach(node => {
        if (node.url) { 
            const bookmarkItem = document.createElement('a');
            bookmarkItem.className = 'bookmark-item';
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
            renderBookmarks(node.children, folderContent);
        }
    });
}

// --- 初始化和事件監聽 ---
function initialize() {
    updateTabList();
    chrome.bookmarks.getTree(tree => {
        if (tree[0] && tree[0].children) {
            bookmarkListContainer.innerHTML = '';
            renderBookmarks(tree[0].children, bookmarkListContainer);
            handleSearch();
        }
    });
    searchBox.addEventListener('input', handleSearch);
}

initialize();

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