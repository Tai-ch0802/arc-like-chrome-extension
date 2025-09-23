const tabListContainer = document.getElementById('tab-list');
const bookmarkListContainer = document.getElementById('bookmark-list');

// --- 處理分頁的函式 (與之前相同) ---
async function updateTabList() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    tabListContainer.innerHTML = '';

    tabs.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        if (tab.active) {
            tabItem.classList.add('active');
        }
        tabItem.dataset.tabId = tab.id;

        const favicon = document.createElement('img');
        favicon.className = 'tab-favicon';
        favicon.src = tab.favIconUrl || 'default_favicon.png';

        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = tab.title;

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
        
        tabListContainer.appendChild(tabItem);
    });
}

// --- 新增：處理書籤的函式 ---
function renderBookmarks(bookmarkNodes, container) {
    bookmarkNodes.forEach(node => {
        // 判斷是書籤 (有 url) 還是資料夾 (有 children)
        if (node.url) { // 這是一個書籤
            const bookmarkItem = document.createElement('a');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.href = node.url;
            bookmarkItem.target = '_blank'; // 在新分頁中打開
            
            const icon = document.createElement('span');
            icon.className = 'bookmark-icon';
            icon.textContent = '★'; // 書籤的圖示
            
            const title = document.createElement('span');
            title.textContent = node.title;

            bookmarkItem.appendChild(icon);
            bookmarkItem.appendChild(title);

            // 監聽點擊事件，用 chrome API 在新分頁打開
            bookmarkItem.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url: node.url });
            });

            container.appendChild(bookmarkItem);

        } else if (node.children) { // 這是一個資料夾
            const folderItem = document.createElement('div');
            folderItem.className = 'bookmark-folder';
            
            const icon = document.createElement('span');
            icon.className = 'bookmark-icon';
            icon.textContent = '▶'; // 預設是收合狀態

            const title = document.createElement('span');
            title.textContent = node.title;
            
            folderItem.appendChild(icon);
            folderItem.appendChild(title);
            container.appendChild(folderItem);

            const folderContent = document.createElement('div');
            folderContent.className = 'folder-content';
            folderContent.style.display = 'none'; // 預設隱藏內容
            container.appendChild(folderContent);

            // 點擊資料夾可以展開/收合
            folderItem.addEventListener('click', () => {
                const isHidden = folderContent.style.display === 'none';
                folderContent.style.display = isHidden ? 'block' : 'none';
                icon.textContent = isHidden ? '▼' : '▶';
            });

            // 遞迴呼叫，處理資料夾內的子項目
            renderBookmarks(node.children, folderContent);
        }
    });
}


// --- 初始化和事件監聽 ---

// 初始載入分頁
updateTabList();

// 監聽分頁變化
chrome.tabs.onUpdated.addListener(updateTabList);
chrome.tabs.onCreated.addListener(updateTabList);
chrome.tabs.onRemoved.addListener(updateTabList);
chrome.tabs.onActivated.addListener(updateTabList);

// 初始載入書籤
chrome.bookmarks.getTree(tree => {
    // Chrome 的書籤樹最頂層是一個包含所有書籤的節點，我們要從它的子節點開始渲染
    if (tree[0] && tree[0].children) {
        renderBookmarks(tree[0].children, bookmarkListContainer);
    }
});
