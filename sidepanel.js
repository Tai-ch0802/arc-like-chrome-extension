const tabListContainer = document.getElementById('tab-list');
const bookmarkListContainer = document.getElementById('bookmark-list');

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

    // --- ↓↓↓ 這裡是本次修正的核心邏輯 ↓↓↓ ---
    // 判斷 tab.favIconUrl 是否存在且為 http/https 網址
    if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
        favicon.src = tab.favIconUrl;
    } else {
        // 對於 chrome:// 內部頁面、載入中的分頁等，都使用預設圖示
        favicon.src = 'icon_default.svg';
    }
    
    // 當網站圖示載入失敗時 (例如 404)，也強制使用預設圖示
    favicon.onerror = () => { 
        favicon.src = 'icon_default.svg'; 
    };
    // --- ↑↑↑ 修正結束 ↑↑↑ ---

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

    tabListContainer.innerHTML = ''; // 清空現有列表

    const groupsMap = new Map(groups.map(group => [group.id, { ...group, tabs: [] }]));
    const ungroupedTabs = [];

    // 將分頁分類到群組或未分組列表
    for (const tab of tabs) {
        if (tab.groupId > 0 && groupsMap.has(tab.groupId)) {
            groupsMap.get(tab.groupId).tabs.push(tab);
        } else {
            ungroupedTabs.push(tab);
        }
    }

    // 1. 渲染分頁群組
    for (const group of groupsMap.values()) {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tab-group-header';

        const arrow = document.createElement('span');
        arrow.className = 'tab-group-arrow';
        arrow.textContent = group.collapsed ? '▶' : '▼';

        const colorDot = document.createElement('div');
        colorDot.className = 'tab-group-color-dot';
        colorDot.style.backgroundColor = group.color;

        const title = document.createElement('span');
        title.textContent = group.title;
        title.style.color = group.color; // 讓標題也帶有顏色

        groupHeader.appendChild(arrow);
        groupHeader.appendChild(colorDot);
        groupHeader.appendChild(title);
        tabListContainer.appendChild(groupHeader);
        
        const groupContent = document.createElement('div');
        groupContent.className = 'tab-group-content';
        groupContent.style.display = group.collapsed ? 'none' : 'block';

        // 渲染群組內的分頁
        group.tabs.sort((a, b) => a.index - b.index).forEach(tab => {
            const tabElement = createTabElement(tab);
            groupContent.appendChild(tabElement);
        });
        tabListContainer.appendChild(groupContent);

        // 點擊事件：展開/收合
        groupHeader.addEventListener('click', () => {
            const isCollapsed = groupContent.style.display === 'none';
            groupContent.style.display = isCollapsed ? 'block' : 'none';
            arrow.textContent = isCollapsed ? '▼' : '▶';
            // 同步更新 Chrome 內建的群組摺疊狀態
            chrome.tabGroups.update(group.id, { collapsed: !isCollapsed });
        });
    }

    // 2. 渲染未分組的分頁
    ungroupedTabs.sort((a, b) => a.index - b.index).forEach(tab => {
        const tabElement = createTabElement(tab);
        tabListContainer.appendChild(tabElement);
    });
}

// --- 處理書籤的函式 (與之前相同) ---
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
            renderBookmarks(tree[0].children, bookmarkListContainer);
        }
    });
}

initialize();

// 更新所有監聽器，確保即時反應
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