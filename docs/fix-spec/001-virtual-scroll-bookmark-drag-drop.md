# 001 - 方案 G：動態渲染取代虛擬滾動

## 目標

1. **移除**現有的 Virtual Scrolling 功能
2. **改用**動態渲染（Lazy Rendering）：只渲染已展開的資料夾內容
3. **保持**完整的拖曳功能相容性

---

## 問題背景

Virtual Scrolling 的扁平化設計與 Sortable 拖曳功能不相容，經過多次嘗試（方案 B、C、F）皆失敗。動態渲染是更務實的替代方案。

---

## 方案 G：動態渲染

### 核心概念

- 書籤資料夾預設收合
- 只有當使用者展開資料夾時，才渲染該資料夾的內容
- 收合時清除該資料夾的 DOM 內容
- 完整保留 Legacy 結構（`.folder-content`）

### 流程

```
[初始載入]
└── 渲染根層級項目（資料夾收合、書籤顯示）

[使用者展開資料夾 A]
└── 取得資料夾 A 的子項目
└── 渲染到 .folder-content
└── 對該容器初始化 Sortable

[使用者收合資料夾 A]
└── 清除 .folder-content 內容
└── 銷毀該容器的 Sortable 實例
```

---

## 實作項目

### Phase 1：移除 Virtual Scrolling

| 項目 | 檔案 | 說明 |
|-----|------|------|
| 移除設定開關 | `themeManager.js` | 移除 Virtual Scrolling 設定選項 |
| 移除狀態管理 | `stateManager.js` | 移除 `isVirtualScrolling` 相關函式 |
| 移除虛擬滾動渲染 | `bookmarkRenderer.js` | 移除 `renderBookmarksVirtual` 及相關函式 |
| 移除工具函式 | `virtualScrollUtils.js` | 移除整個檔案（或保留非虛擬滾動相關的工具） |
| 移除 CSS | `sidepanel.css` | 移除 `.virtual-scroll-container` 相關樣式 |
| 更新條件判斷 | `bookmarkRenderer.js` | `renderBookmarks` 直接使用 Legacy 邏輯 |

### Phase 2：實作動態渲染

| 項目 | 檔案 | 說明 |
|-----|------|------|
| 修改資料夾渲染 | `bookmarkRenderer.js` | 收合狀態時不渲染子項目 |
| 展開時渲染 | `bookmarkRenderer.js` | 點擊展開時動態取得並渲染子項目 |
| 收合時清除 | `bookmarkRenderer.js` | 收合時清除 `.folder-content` 內容 |
| Sortable 動態初始化 | `dragDropManager.js` | 展開時對新容器初始化 Sortable |
| 刷新邏輯優化 | `bookmarkRenderer.js` | 只重新渲染已展開的資料夾（可選） |

---

## 程式碼示意

### 資料夾展開/收合

```javascript
async function toggleFolder(folderId, folderElement, refreshCallback) {
    const folderContent = folderElement.querySelector('.folder-content');
    const icon = folderElement.querySelector('.bookmark-icon');
    
    if (state.isFolderExpanded(folderId)) {
        // 收合：清除 DOM
        folderContent.innerHTML = '';
        state.removeExpandedFolder(folderId);
        icon.textContent = '▶';
    } else {
        // 展開：動態渲染
        const children = await api.getBookmarkChildren(folderId);
        renderBookmarksLegacy(children, folderContent, folderId, refreshCallback);
        state.addExpandedFolder(folderId);
        icon.textContent = '▼';
        // 初始化 Sortable
        initializeSortableForContainer(folderContent);
    }
}
```

### 初始渲染（只渲染根層級）

```javascript
function renderBookmarks(bookmarkNodes, container, parentId, refreshCallback) {
    container.innerHTML = '';
    for (const node of bookmarkNodes) {
        if (node.url) {
            container.appendChild(createBookmarkItem(node));
        } else {
            const folder = createFolderElement(node);
            const folderContent = document.createElement('div');
            folderContent.className = 'folder-content';
            folderContent.dataset.parentId = node.id;
            
            // 如果在展開狀態，渲染子項目
            if (state.isFolderExpanded(node.id)) {
                api.getBookmarkChildren(node.id).then(children => {
                    renderBookmarksLegacy(children, folderContent, node.id, refreshCallback);
                    initializeSortableForContainer(folderContent);
                });
            }
            
            folder.appendChild(folderContent);
            container.appendChild(folder);
        }
    }
}
```

---

## 需要移除的程式碼

### `stateManager.js`
- `isVirtualScrolling` 變數
- `initVirtualScrolling()`
- `isVirtualScrollingEnabled()`
- `setVirtualScrollingEnabled()`

### `bookmarkRenderer.js`
- `renderBookmarksVirtual()`
- `createVirtualBookmarkItem()`
- `createVirtualFolderItem()`
- `ITEM_HEIGHT` 常數
- Virtual 相關的滾動監聽器

### `virtualScrollUtils.js`
- `flattenBookmarkTree()` - 可考慮保留或移除

### `themeManager.js`
- Virtual Scrolling 設定開關 UI

### `sidepanel.css`
- `.virtual-scroll-container`
- `.virtual-item`

---

## 驗證計畫

1. **拖曳功能**
   - 書籤在同資料夾內排序
   - 書籤跨資料夾移動
   - 分頁拖曳新增為書籤

2. **展開/收合**
   - 展開資料夾顯示內容
   - 收合資料夾清除內容
   - 巢狀資料夾正確處理

3. **效能**
   - 大量書籤（1000+）初始載入速度
   - 展開大型資料夾的反應時間

4. **狀態保持**
   - 重新載入後展開狀態保持
   - 書籤操作後 UI 正確更新
