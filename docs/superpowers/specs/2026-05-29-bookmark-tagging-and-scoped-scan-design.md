# 批 A 設計：書籤貼標籤 + 局部目錄掃描

- **日期**：2026-05-29
- **狀態**：設計已核可，待寫實作計畫
- **範圍**：本專案近期大改後的修正第 1 批（共 4 批）。本批只涵蓋議題 #1（書籤貼 label）與 #2（局部目錄掃描）。
- **明確排除**：AI 書籤整理（現不存在，屬全新功能，留待 A～D 收完後單獨評估）。

---

## 1. 背景與問題

近期一波大改後，書籤標籤系統與書籤掃描工具留下兩個缺口：

1. **標籤無法貼到書籤上**。`modules/bookmark/tagManager.js` 已完整實作標籤 CRUD 與書籤↔標籤關聯（`addTagToBookmark` / `removeTagFromBookmark` / `getTagsForBookmark`），但這三個函式**全程式碼零呼叫**——只有標籤管理 UI（建立／改名／刪除），沒有任何地方能把標籤指派給單一書籤，書籤列上也看不到已貼的標籤。
2. **書籤掃描只能掃全部**。`重複書籤` 與 `死連結` 掃描都對整個書籤快取作業，使用者難以辨識「要刪的書籤位在哪個資料夾」，也無法只整理某個資料夾的子樹。

## 2. 目標

- 讓使用者能對單一書籤**指派／移除標籤**，並在書籤列上**看見**已貼標籤。
- 讓使用者能**限定資料夾範圍**做重複／死連結掃描，掃描範圍與筆數清楚可見。

### 非目標

- 不改標籤資料層（`tagManager.js` 已足夠）。
- 不做 AI 書籤整理。
- 死連結結果顯示資料夾路徑、分頁清理顯示 group——屬**批 B**，本批不做。

---

## 3. 現況事實（已驗證）

| 項目 | 事實 | 出處 |
|------|------|------|
| 標籤資料層 | `addTagToBookmark`/`removeTagFromBookmark`/`getTagsForBookmark` 已實作，零呼叫 | `modules/bookmark/tagManager.js:41,96,108` |
| 標籤儲存 | `chrome.storage.local` 的 `tags` / `bookmarkTags` 兩個 key | `tagManager.js:8-10` |
| 書籤列渲染 | `createBookmarkItem` / `updateBookmarkElement`，事件用委派 | `modules/ui/bookmarkRenderer.js:490,389,167` |
| 書籤列**無右鍵選單** | `contextMenuManager` 只綁在分頁；書籤列只委派 `click`/`keydown` | `contextMenuManager.js:181`、`bookmarkRenderer.js:178,352` |
| 編輯書籤對話框 | `showFormDialog`，只有 title/url 兩個 text 欄位 | `bookmarkRenderer.js:192-199` |
| `showFormDialog` 能力 | 只支援 `text` 與 `select`，無自訂欄位 | `modalManager.js:210-284` |
| **無** `showFolderPicker` | 不存在；但 `showAddToBookmarkDialog` 內有現成資料夾樹選擇模式 | `modalManager.js:342-496` |
| 重複掃描 | `findDuplicates()` 無參數，內部讀 `state.getBookmarkCache()` | `dedupe.js:25-26` |
| 死連結掃描 | `scanDeadLinks(bookmarks, onProgress)`，收書籤陣列 | `deadLinkChecker.js:40` |
| 書籤快取結構 | `{ id, title, url, parentId, type, path }`（含資料夾節點） | `stateManager.js:432,444-468` |
| 工具對話框 | tabs：tags / duplicates / deadLinks，`openBookmarkToolsDialog(initialTab)` | `bookmarkToolsUI.js:20-59` |

---

## 4. 設計

### 4.1 共用元件：Tag Picker

新增 `modules/bookmark/tagPicker.js`：

```
createTagPicker(initialTagIds: string[]) → { element: HTMLElement, getSelectedTagIds(): string[] }
```

- 渲染所有標籤（`tagManager.getAllTags()`）為帶顏色 chip 的勾選清單，`initialTagIds` 預先勾選。
- 底部「＋ 新增標籤」：呼叫 `modal.showPrompt` 取名 → `tagManager.createTag` → 動態加一列並勾選。
- **不自行寫入**儲存，只負責呈現與回傳選取狀態；寫入由呼叫端決定（popover 即時寫、對話框存檔時寫），讓元件單一職責、可測。
- 鍵盤可操作（沿用 modal focus trap 與方向鍵慣例）。

### 4.2 入口 1：書籤列右鍵選單（標籤 + 資料夾整理）

在 `bookmarkRenderer.js` 的 `initBookmarkListeners` 增加委派 `contextmenu` 監聽（用既有 `AbortController` signal，維持清理一致性）：

- 命中 `.bookmark-item`（書籤）→ 開書籤選單：**複製 URL**、**管理標籤**。
- 命中 `.bookmark-folder`（資料夾）→ 開資料夾選單：**整理此資料夾**（子項：找重複 / 查死連結）。

選單 DOM／定位／關閉／focus 還原邏輯沿用 `contextMenuManager` 的既有實作。為避免和分頁選單耦合，新增一支 `showBookmarkContextMenu(x, y, node, originElement, { isFolder })`（與 `showContextMenu` 並存，共用內部 helper；若重複過多則抽共用建構器，但不強制大重構）。

- **管理標籤** 點擊：在選單原位展開／另開一個含 `createTagPicker(getTagsForBookmark(id))` 的輕量 popover。勾選變更**即時**呼叫 `addTagToBookmark`/`removeTagFromBookmark`，關閉時觸發該列重繪。

### 4.3 入口 2：編輯書籤對話框加標籤欄位

擴充 `modalManager.showFormDialog` 支援泛用自訂欄位：

```
{ type: 'custom', name: 'tags', render: () => ({ element, getValue }) }
```

- 渲染時把 `field.render()` 的 `element` 插入表單；`submit` 時對所有 custom 欄位呼叫 `getValue()` 併入結果（FormData 無法序列化勾選狀態，故走 getter）。
- `bookmarkRenderer.js` 的 `edit-bookmark` action 在 title/url 後加一個 `tags` custom 欄位，內容為 `createTagPicker(getTagsForBookmark(id))`。
- 存檔時：除既有 `updateBookmark(title,url)` 外，計算選取 tagIds 與原本的差集，呼叫 `addTagToBookmark`/`removeTagFromBookmark` 補齊，然後 `handleRefresh()`。

### 4.4 書籤列顯示已貼標籤

在 `updateBookmarkElement`（`bookmarkRenderer.js:389`）標題 wrapper 後渲染標籤指示：

- 讀 `tagManager.getTagsForBookmark(node.id)`；每個標籤一顆帶該標籤顏色的小 chip／圓點（窄面板下用圓點 + hover/title 顯示名稱，避免擠壓）。
- 無標籤則不渲染；沿用既有 recycling，重繪時更新。
- 顏色沿用標籤的 `color`（對應 `getPresetColors()` 八色），CSS 變數對映既有調色盤。

### 4.5 局部目錄掃描

**資料層** `stateManager.js` 新增：

```
getBookmarkCacheUnderFolder(folderId: string) → cacheEntry[]
```

- 以 `getBookmarkCache()` 建 `parentId → children[]` 映射，自 `folderId` DFS 收集子樹中 `type === 'bookmark'` 的項目（含巢狀子資料夾）。`folderId` 省略或無效時回傳全部。

**掃描函式 scope 化**：

- `deadLink.scanDeadLinks(bookmarks, onProgress)`：已收陣列，呼叫端傳限定後的書籤即可。
- `dedupe.findDuplicates(cacheOverride?)`：新增可選參數，預設 `state.getBookmarkCache()`，scope 時傳 `getBookmarkCacheUnderFolder(folderId)`。

**UI** `bookmarkToolsUI.js`：

- `openBookmarkToolsDialog(initialTab, { scopeFolderId } = {})` 新增可選 scope。
- 對話框頂部加「範圍」列：顯示目前範圍名稱與筆數（如「整理中：開發/工具（12 筆）」），附「變更範圍」鈕。
- 變更範圍：複用 `showAddToBookmarkDialog` 的資料夾樹選擇模式（必要時抽成可重用的 `pickFolder()`，回傳 `{ id, path }`）；「全部」為預設選項。
- `renderDuplicatesView` / `renderDeadLinksView` 依目前 scope 取書籤集合。
- 右鍵資料夾「整理此資料夾」→ 以該 `folderId` 開對話框並定位到對應 tab。

---

## 5. 影響面與相依

- **改動檔案**：`bookmarkRenderer.js`（右鍵監聽、標籤顯示、編輯欄位）、`modalManager.js`（custom 欄位、抽 `pickFolder`）、`bookmarkToolsUI.js`（scope）、`dedupe.js`（可選參數）、`stateManager.js`（新 helper）、`contextMenuManager.js`（書籤選單）、新增 `tagPicker.js`、`sidepanel.css`（chip／popover／scope 列樣式）。
- **i18n**：新增 UI 字串（管理標籤、整理此資料夾、找重複、查死連結、範圍、變更範圍、新增標籤…）須補進 `_locales` 全語系，沿用既有補 key 流程。
- **連動檢視**：依 `RULE_002_ARCHITECTURE.md`，改 `bookmarkRenderer.js` 需檢視相依的渲染／拖放路徑；右鍵 `contextmenu` 不可與既有拖放（dragDropManager）衝突。
- **不影響**：標籤資料層、工作區、設定。

## 6. 邊界與安全

- 右鍵選單須 `preventDefault` 並與既有左鍵委派、拖放並存不衝突。
- 標籤即時寫入採既有 `tagManager` 持久化（已處理孤兒清理 `pruneOrphanedBookmarkTags`）。
- scope 掃描沿用既有刪除安全閥（死連結預設不勾、離線偵測、過高失敗率警告；重複組至少保留一份）。
- 大量書籤下標籤顯示走既有 recycling，不額外大量 DOM。

## 7. 測試策略

- 單元：`getBookmarkCacheUnderFolder`（巢狀、空資料夾、無效 id）；`findDuplicates(scope)`；tagPicker 的 `getSelectedTagIds` 差集計算。
- E2E（Puppeteer，沿用 `usecase_tests`）：右鍵書籤貼/移標籤→書籤列出現/消失 chip；編輯對話框改標籤後保存；右鍵資料夾→工具對話框 scope 正確、筆數正確、刪除只影響該資料夾。

## 8. 後續批次（備忘，非本批範圍）

- **批 B**：死連結結果顯示資料夾路徑 + 分頁清理顯示 group badge（#3）。
- **批 C**：切換工作區還原 tab group（#4）+ 分頁內容是否跨裝置同步決策（#5）。
- **批 D**：設定 dialog → 獨立 options page（#6）。
- **未排程**：AI 書籤整理（全新功能）。
