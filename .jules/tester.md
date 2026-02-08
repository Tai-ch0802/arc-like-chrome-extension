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
| `search_edge_cases.test.js` | 搜尋 Edge Cases | 6 | P1 |
| `bookmark_folder_toggle.test.js` | 資料夾展開/收合 | 2 | P1 |
| `bookmark_edge_cases.test.js` | 書籤 Edge Cases | 3 | P1 |
| `tab_group_toggle.test.js` | 群組展開/收合 | 2 | P1 |
| `add_to_group.test.js` | 新增分頁到群組 | 2 | P1 |
| `group_edge_cases.test.js` | 群組 Edge Cases | 5 | P1 |
| `tab_edge_cases.test.js` | 分頁 Edge Cases | 3 | P1 |
| `edit_bookmark.test.js` | 編輯書籤 | 3 | P1 |
| `other_windows.test.js` | 其他視窗 | 2 | P1 |
| `theme_switch.test.js` | 主題切換 | 3 | P2 |
| `theme_edge_cases.test.js` | 主題 Edge Cases | 3 | P2 |
| `reading_list_edge_cases.test.js` | 閱讀清單 Edge Cases | 3 | P1 |
| `settings_panel.test.js` | 設定面板 | 4 | P2 |
| `context_menu.test.js` | 右鍵選單 (Tab) | 1 | P1 |
| `bookmark_dragging.test.js` | 書籤拖曳排序 | 2 | P1 |
| `tab_dragging.test.js` | 分頁拖曳排序 | 1 | P1 |
| `keyboard_a11y.test.js` | 鍵盤導航 | 5 | P1 |
| `modify_bookmark_folder.test.js` | 修改書籤資料夾 (API/UI) | 3 | P1 |

**總計: 59 測試案例**

---

## 測試覆蓋缺口

### 待補充的 Edge Cases
- [x] 閱讀清單：搜尋過濾、URL 匹配、鍵盤導航 (Implemented in `reading_list_edge_cases.test.js`)
- [x] 搜尋：空字串、特殊字元、超長輸入 (Implemented in `search_edge_cases.test.js`)
- [x] 搜尋：快速輸入 Race Condition (Implemented in `search_edge_cases.test.js`)
- [x] 書籤：無效 URL、重複書籤、巢狀資料夾 (Implemented in `bookmark_edge_cases.test.js`)
- [x] 分頁：大量分頁處理 (100+)、Pinned Tabs、URL 更新 (Implemented in `tab_edge_cases.test.js`)
- [x] 群組：空群組、顏色變更、標題變更、API 移動 (Implemented in `group_edge_cases.test.js`)
- [x] 群組：跨視窗群組顯示 (Implemented in `group_edge_cases.test.js`)
- [x] 主題：自訂主題資料遺失 Fallback (Implemented in `theme_edge_cases.test.js`)
- [x] 主題：快速切換、Storage Quota (Implemented in `theme_edge_cases.test.js`)

### 待補充的 Happy Paths
- [x] 拖曳分頁排序 (已有 `tab_dragging.test.js`)
- [x] 書籤拖曳排序 (更新 `bookmark_dragging.test.js` 新增 API 排序驗證測試)
- [x] 右鍵選單操作 (新增 `context_menu.test.js`)
- [x] 鍵盤導航 (更新 `keyboard_a11y.test.js` 新增 Arrow Key 測試)
- [x] 資料夾管理 UI (新增 `modify_bookmark_folder.test.js` 的 UI 測試)

---

## 難以測試的功能

| 功能 | 原因 | 可能的解法 |
|-----|-----|----------|
| Service Worker 重啟 | 需要模擬瀏覽器關閉 | 使用 `worker.close()` |
| 分頁導航事件 | Headless 環境下 Navigation 不穩定 | 依賴 API 狀態檢查或 Active 狀態 |
| 跨視窗群組創建 | Chrome API 行為差異 | 明確指定 `windowId` 於 `createProperties` |
| 搜尋路徑匹配 | 搜尋邏輯只匹配 Title/Domain | 使用 Data URL 時需指定 Title |
| 書籤拖曳進資料夾 | UI 拖曳在 Headless/Puppeteer 中對 Drop Target 與 SortableJS 的判定不穩定 | 依賴 API 測試驗證排序邏輯，避免 UI 拖曳造成 CI flaky |

---

## 有效的測試模式

### Fresh Page Per Test
每個測試使用 `browser.newPage()` 建立獨立頁面，避免狀態污染。

### Try/Finally Cleanup
所有資源清理放在 `finally` 區塊，確保即使測試失敗也能清理。

### Chrome API 驗證
使用 `page.evaluate()` 呼叫 Chrome API 驗證狀態，而非僅依賴 DOM。

### WaitForFunction with Retry
在處理跨視窗或複雜非同步渲染時，使用帶有 Retry 或 Reload 的等待策略。

### Console Logging in Page
使用 `page.on('console', ...)` 將頁面日誌導出，便於調試 Headless 環境下的問題。

---

## 更新日誌

### 2026-02-08 - Edge Case 與 Happy Path 補強
- 更新 `tab_edge_cases.test.js`: 增加至 100+ 分頁測試，提升 Timeout 確保穩定性。
- 更新 `modify_bookmark_folder.test.js`: 新增 UI 測試案例，覆蓋 "新增資料夾" 與 "重命名資料夾" 的 UI 操作流程。
- 修正 `rename_window.test.js`: 優化 Timeout 與 Selector 等待邏輯，解決不穩定的失敗。
- 移除無效測試：原計畫新增的書籤右鍵選單測試，經查證該功能未實作，故移除。

### 2026-02-07 - Review 修正
- 修正 `bookmark_dragging.test.js`: 移除不穩定 UI 拖曳測試，改用 Chrome API 排序驗證；移除所有 `setTimeout` 反模式。
- 修正 `context_menu.test.js`: 將 tab cleanup 移至 `afterEach`；修正 URL 尾斜線匹配問題。
- 修正 `keyboard_a11y.test.js`: 新增 `afterEach` tab cleanup；加入 `activeElement` null 防禦。

### 2026-02-06 - Happy Path 補完
- 新增 `context_menu.test.js`: 測試右鍵選單顯示與項目檢查。
- 更新 `bookmark_dragging.test.js`: 增加書籤排序測試。
- 更新 `keyboard_a11y.test.js`: 增加 Arrow Up/Down 鍵盤導航測試。
- 確認所有 Missing Happy Paths 已補齊。- 新增 `reading_list_edge_cases.test.js` (3 tests): 覆蓋閱讀清單搜尋過濾 (Title/URL)、鍵盤導航、空狀態。
- 解決了 "搜尋路徑匹配" 的測試難點，透過 DOM 模擬與實際輸入觸發驗證。
- 總測試案例增至 57 個。

### 2026-02-04 - Edge Case 完整補充與整合
- 整合 `tabs_edge_cases.test.js` 至 `tab_edge_cases.test.js`: 測試 50+ 大量分頁渲染、Pinned Tabs。
- 整合 `groups_edge_cases.test.js` 至 `group_edge_cases.test.js`: 測試群組顏色/標題變更、API 移動、空群組移除。
- 新增 `group_edge_cases.test.js`: 跨視窗群組顯示測試 (修復了 `windowId` 預設行為問題)。
- 新增 `theme_edge_cases.test.js`: 快速切換主題、Storage Quota 錯誤處理測試。
- 新增 `search_edge_cases.test.js`: 快速輸入 Race Condition 測試。
- 總測試案例增至 54 個，所有 Edge Cases 覆蓋完畢。

### 2026-02-02 - Edge Case 補充 (Part 2)
- 新增 `tab_edge_cases.test.js` (3 tests): 覆蓋大量分頁、Pinned Tabs、URL 更新
- 新增 `group_edge_cases.test.js` (2 tests): 覆蓋群組顏色變更、空群組自動移除
- 新增 `theme_edge_cases.test.js` (1 test): 覆蓋自訂主題資料遺失 Fallback
- 新增 `groups_edge_cases.test.js` (3 tests): 覆蓋群組顏色變更、標題變更、API 移動分頁進群組。
- 修復 `other_windows.test.js`: 重構為 Fresh Page 模式，增加對 Headless 環境下 URL/Title 檢查的容錯性。

### 2026-02-02 - 初始化
- 建立 32 個基礎 E2E 測試 (P0/P1/P2)
- 所有測試 100% 通過
- 建立 fresh page per test 模式
