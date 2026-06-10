# [Fix/T1] Spotlight 動作路由修正（#162 WP3：A1/A2/A3/A4）

## 背景與問題

- **A1 [High]**：`pendingPanelAction` 是全域 session 旗標，**每個**開著的 sidepanel 都會收到 `storage.session.onChanged` 並以「get → remove」非原子順序消費 —— 多視窗下：(1) 已開著 panel 的視窗 C 會搶在目標視窗 A 之前執行（smart-group 動到錯誤視窗的分頁）；(2) 兩個 panel 可在 remove 前都讀到值 → 雙重執行（switch-workspace 開出兩個重複視窗）。
- **A2 [Med]**：`spotlightWindowId` 是 SW 模組狀態；SW idle 回收後 `onFocusChanged` 守門永遠 false → 失焦自動關閉失效（孤兒 popup）。且 `openSpotlight` 的 focus-existing 路徑不更新 `spotlightOriginWindowId`，spotlight 頁又只在 DOMContentLoaded 讀一次 → 動作路由到舊 origin 視窗。
- **A3 [Med]**：`pendingPanelAction` 無 TTL；`sidePanel.open` 失敗時旗標殘留整個 session，下次手動開任何 panel 時突發執行陳年動作。
- **A4 [Low]**：palette 的 tab 結果含 Spotlight 自身分頁（選中即自我關閉的無效項）。

## 方案

1. **定址 + 認領消費（A1）**：`requestPanelAction` 先解析目標視窗，payload 帶 `windowId`；各 panel 啟動時記住自己的 windowId，**只消費寄給自己的動作**（mismatch 一律不動、留給目標 panel）。同視窗僅一個 panel → 認領競態消失。`classifyPendingAction` 抽成純函式（execute / ignore / expired）供單元測試。
2. **TTL + 失敗清理（A3）**：消費時丟棄 >15s 的動作並清旗標；`requestPanelAction` 的 `sidePanel.open` 失敗路徑主動 remove 旗標。
3. **Spotlight id 進 session（A2）**：`spotlightWindowId` 同步寫入 `chrome.storage.session`；`onFocusChanged` 在模組快取為 null 時 lazy 從 session 補位後再判斷。`openSpotlight` 把 origin 寫入移到 focus-existing 分支**之前**（兩條路徑都更新）；spotlight 頁加 `storage.session.onChanged` 監聽，origin 變更即 `setOriginWindowId`。
4. **過濾自身（A4）**：`getTabResults` 排除 `spotlight.html` 自身分頁。

排除的替代方案：改用 `chrome.tabs.sendMessage`/port 點對點路由 —— 需要 panel 註冊 port 生命週期管理，比定址旗標複雜且 sidePanel.open 後的時序更難保證；定址 + TTL 已消除全部已知失效模式。

## 影響面

- `modules/commandPalette/panelBridge.js`（定址、TTL 清理、純函式）
- `sidepanel.js`（消費守門：windowId + TTL）
- `background.js`（Spotlight 區段：session 持久化 id、lazy 補位、origin 重寫時機）
- `spotlight.js`（origin 變更監聽）
- `modules/commandPalette/dataProvider.js`（自身分頁過濾）
- 無 storage schema / manifest / i18n 變更

## Test Impact

- 新增 `unit_tests/panelBridge.test.mjs`：`classifyPendingAction` 的 execute / ignore（錯視窗）/ expired（TTL）/ 缺欄位案例。
- 既有 `happy_path_spotlight_search.test.js` 等 spotlight E2E 必須全綠。
- 驗證指令：`npm run test:unit`、`npm run test:ci`。

## 驗收條件

- [ ] 多視窗情境：動作只在目標視窗執行（由 classify 純函式單元測試保證 ignore 行為）。
- [ ] 過期動作（>15s）被丟棄且旗標清除。
- [ ] `sidePanel.open` 失敗不留殘旗標。
- [ ] SW 重啟後（模組快取歸零）失焦仍能關閉既有 Spotlight；focus-existing 路徑後動作路由到新 origin。
- [ ] palette 不再列出 Spotlight 自身分頁。
- [ ] unit + happy_path E2E 全綠。
