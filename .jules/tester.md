# Tester 🧪 - E2E Testing Log

> 此檔案由 Testing Enthusiast Agent 維護，記錄測試覆蓋狀態與學習。

## 現有測試清單

| 檔案 | 功能 | 測試數 | 優先級 |
|-----|-----|-------|-------|
| `sidepanel_load.test.js` | 側邊欄載入 | 6 | P0 |
| `tab_switch.test.js` | 分頁切換 | 2 | P0 |
| `tab_close.test.js` | 關閉分頁 | 2 | P0 |
| `open_bookmark.test.js` | 開啟書籤 | 2 | P0 |
| `search.test.js` | 搜尋過濾 | 4 | P0 |
| `search_edge_cases.test.js` | 搜尋 Edge Cases | 5 | P1 |
| `bookmark_folder_toggle.test.js` | 資料夾展開/收合 | 2 | P1 |
| `bookmark_edge_cases.test.js` | 書籤 Edge Cases | 3 | P1 |
| `tab_group_toggle.test.js` | 群組展開/收合 | 2 | P1 |
| `add_to_group.test.js` | 新增分頁到群組 | 2 | P1 |
| `groups_edge_cases.test.js` | 群組 Edge Cases | 3 | P1 |
| `tabs_edge_cases.test.js` | 分頁 Edge Cases | 2 | P1 |
| `edit_bookmark.test.js` | 編輯書籤 | 3 | P1 |
| `other_windows.test.js` | 其他視窗 | 2 | P1 |
| `theme_switch.test.js` | 主題切換 | 3 | P2 |
| `settings_panel.test.js` | 設定面板 | 4 | P2 |

**總計: 47 測試案例**

---

## 測試覆蓋缺口

### 待補充的 Edge Cases
- [x] 搜尋：空字串、特殊字元、超長輸入 (Implemented in `search_edge_cases.test.js`)
- [x] 書籤：無效 URL、重複書籤、巢狀資料夾 (Implemented in `bookmark_edge_cases.test.js`)
- [x] 分頁：大量分頁處理、Pinned Tabs (Implemented in `tabs_edge_cases.test.js`)
- [x] 群組：跨視窗操作 (Tested in `other_windows.test.js` and `groups_edge_cases.test.js`)
- [x] 群組：群組顏色/標題變更 (Implemented in `groups_edge_cases.test.js`)

### 待補充的 Happy Paths
- [ ] 拖曳分頁排序 (已有 `tab_dragging.test.js`)
- [ ] 書籤拖曳排序 (已有 `bookmark_dragging.test.js`)
- [ ] 右鍵選單操作
- [ ] 鍵盤導航 (已有 `keyboard_a11y.test.js`)

---

## 難以測試的功能

| 功能 | 原因 | 可能的解法 |
|-----|-----|----------|
| Service Worker 重啟 | 需要模擬瀏覽器關閉 | 使用 `worker.close()` |
| 跨視窗操作 | Puppeteer 跨視窗較複雜 | 使用 `browser.pages()` |
| 分頁導航事件 | Headless 環境下 Navigation 不穩定 | 依賴 API 狀態檢查或 Active 狀態 |

---

## 有效的測試模式

### Fresh Page Per Test
每個測試使用 `browser.newPage()` 建立獨立頁面，避免狀態污染。

### Try/Finally Cleanup
所有資源清理放在 `finally` 區塊，確保即使測試失敗也能清理。

### Chrome API 驗證
使用 `page.evaluate()` 呼叫 Chrome API 驗證狀態，而非僅依賴 DOM。

### Relaxed Assertions for Rendering
在 Headless 環境下，某些 DOM 屬性 (如 `dataset.url`) 可能因導航未完成而為空，測試應容許檢查其他屬性 (如 `title`) 或僅檢查元素存在性。

---

## 更新日誌

### 2026-02-02 - Edge Case 補充 Part 2
- 新增 `tabs_edge_cases.test.js` (2 tests): 覆蓋大量分頁 (Stress Test) 與 Pinned Tabs 顯示。
- 新增 `groups_edge_cases.test.js` (3 tests): 覆蓋群組顏色變更、標題變更、API 移動分頁進群組。
- 修復 `other_windows.test.js`: 重構為 Fresh Page 模式，增加對 Headless 環境下 URL/Title 檢查的容錯性。
- 總測試案例增至 47 個。

### 2026-02-02 - Edge Case 補充
- 新增 `search_edge_cases.test.js` (5 tests): 覆蓋特殊字元、Regex、XSS、長輸入、無結果
- 新增 `bookmark_edge_cases.test.js` (3 tests): 覆蓋深層巢狀、重複書籤、無效 URL
- 總測試案例增至 40 個

### 2026-02-02 - 初始化
- 建立 32 個基礎 E2E 測試 (P0/P1/P2)
- 所有測試 100% 通過
- 建立 fresh page per test 模式
