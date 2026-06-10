# [Fix/T1] Rebind 涵蓋面補強（#162 WP2：F6 + lastActiveAt）

## 背景與問題

- **F6 [Med]**：工作區自動重綁只掛在 `runtime.onStartup`。macOS 上 Chrome 在最後一扇視窗關閉後仍常駐 —— 從 Dock／⇧⌘T 重開視窗**不是** browser startup，`rebindAfterStartup` 永不執行，視窗回來全是「無工作區」（關窗時 `windows.onRemoved` 已按設計清掉綁定）。這是本專案開發平台（macOS）的主要使用路徑。
- **lastActiveAt scramble [Low]**：rebind 逐筆呼叫 `setActiveWorkspace` 會 bump `lastActiveAt`，每次重啟都打亂切換器的 recency 排序。

## 方案

1. **F6**：`windows.onCreated`（僅 normal 視窗）→ 單一共用 4s debounce → `rebindOnce()`。
   - Cmd+N 空白新窗：`rebindOnce` 內部過濾（無 http 分頁→無候選）→ 廉價 no-op。
   - 瀏覽器啟動時的 onCreated 風暴：debounce 收斂成一次額外 no-op pass（與 onStartup 路徑並存無害）。
   - 回復視窗的分頁即使未載入也立即帶 url，4s 足夠 settle。
2. **lastActiveAt**：rebind 的綁定改傳 `{ touch: false }`（WP1 schema v2 新增的參數；在 v2 合併前是被忽略的多餘參數 —— 行為照舊，v2 合併後自動生效，**與 WP1 PR 無檔案交集、無合併順序要求**）。

排除的替代方案：`windows.onRestored` 不存在於 extension API；`sessions.onChanged` 噪音大且不保證涵蓋 Dock 重開。

## 影響面

僅 `modules/workspace/workspaceLifecycle.js`（新 listener + debounce 常數 + touch 參數）。無 storage / manifest / i18n 變更。

## Test Impact

- 匹配邏輯本身由 `workspaceMatching.test.mjs` 守護（含 WP1 margin 案例）；本 WP 是事件接線。
- E2E `happy_path_` 全套需綠（rebindOnce 在測試環境為 no-op：測試視窗無對應快照）。

## 驗收條件

- [ ] macOS「關最後一扇窗 → Dock 重開」路徑：視窗重綁回原工作區（手動驗證步驟：綁定工作區 → 關窗 → Dock 開新窗 → ⇧⌘T 回復 → ≤5s 內 sidepanel 顯示原工作區）。
- [ ] Cmd+N 純新窗不觸發任何綁定。
- [ ] 重啟/重綁後切換器排序不變（touch:false，於 WP1 合併後生效）。
- [ ] unit + happy_path E2E 全綠。
