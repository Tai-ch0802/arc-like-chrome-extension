# [Feature/T1] UX 整合包（#162 WP6）

## 背景與問題

四路審查的 [UX] 觀察：Spotlight 與 sidepanel 是兩套割裂的體驗 —— 切工作區繞道 sidepanel（A 窗彈 panel、焦點卻跳去 B 窗）、兩個搜尋面是兩套查詢語言（Spotlight 不認 `tag:`）；dot-click 只能單 tag（引擎卻支援 AND）；workspace 按鈕無「可開管理」暗示；tag 建立兩個入口行為不一致（tagPicker 永遠藍色、無唯一性檢查）；palette 工作區列硬編英文 `N tab(s)`；density/radius 收斂半途而廢。

## 方案（逐項小步、互不依賴）

1. **Spotlight 直切工作區**：palette workspace handler 直呼 `switchWorkspace(id, originWindowId)`（非破壞性 focus-or-open；spotlight 已 init workspaceManager）。不再 `requestPanelAction` 繞道。
2. **Spotlight 支援 `tag:`**：`searchAll` 開頭以 `parseSearchQuery`（重用純函式）解析；命中 tag 時僅書籤參與（= sidepanel 隱藏非書籤區段的對等行為），AND 語意與 sidepanel 一致；spotlight init 補 `tagManager.initTags()`。
3. **Dot-click 組合**：append token（去重）而非取代 —— 解鎖引擎本就支援的多 tag AND。
4. **Workspace 按鈕 affordance**：trailing `expand_more` chevron（aria-hidden，label 已有 a11y）。
5. **Tag 入口一致化**：tagPicker「+ New tag」改用 `showTagDialog` 色彩對話框；新增 `findTagByName`（不分大小寫）—— 兩個建立入口同名沿用既有 tag（tagPicker 直接勾選），杜絕 Work/work 並存。
6. **palette 工作區列 i18n**：新 key `cmdPaletteWorkspaceTabs`（帶 `$count$` placeholder）×14 語系。
7. **Density/radius 收斂**：`.tab-group-header` padding 改 `var(--list-row-py)`、radius 2px→`--arc-radius-sm`；`.workspace-manage__create`/`.drive-sync-badge`/`.custom-theme-panel` 4px→`--arc-radius-xs`。

## 影響面

`dataProvider.js`、`spotlight.js`、`bookmarkRenderer.js`、`tagPicker.js`、`bookmarkToolsUI.js`、`tagManager.js`（新純函式）、`sidepanel.html`、`sidepanel.css`、`_locales/*/messages.json` ×14。無 storage schema / manifest 變更。

## Test Impact

- 純函式重用（parseSearchQuery/bookmarkMatchesTags）已有測試；`findTagByName` 行為簡單（大小寫不敏感查找）。
- E2E `happy_path_` 全套需綠（含 spotlight 搜尋）。
- i18n：14 檔 JSON 插入後逐一 `json.load` 驗證。

## 驗收條件

- [ ] Spotlight 選工作區 → 直接聚焦/開啟工作區視窗，不彈 sidepanel。
- [ ] Spotlight 輸入 `tag:work` → 僅書籤群組、結果與 sidepanel 同。
- [ ] 連點兩顆 dot → search box 為 `tag:a tag:b`（AND）。
- [ ] 兩個建立入口：同名（含大小寫差異）不再產生第二顆 tag。
- [ ] palette 工作區列 subtitle 隨 UI 語言在地化。
- [ ] unit + happy_path E2E 全綠。
