# NOTE 2026-06-02 — Unified Spotlight Search（T1–T9 完整收尾）

## 背景
分支 `feat/spotlight-search`。全域 Cmd+Shift+K 快速搜尋（「Spotlight」）功能完整實作。spec：`docs/specs/…/unified-spotlight-search`（PRD+SDD）；plan：T1–T9。本筆記為 T9 收尾紀錄，涵蓋整個功能的摘要。

## 做了什麼（T1–T9）

- **T1 — searchScope helper**：`modules/utils/searchUtils.js` 加 `searchScope({keywords,tags})`，回傳 `{filterPanelSections:boolean}`；`tag:` 查詢回傳 `false`（只篩書籤）、一般查詢回傳 `true`。
- **T2 — searchManager filter rework**：`handleSearch` 改用 `searchScope`；`filterPanelSections=false` 時呼叫 `hideNonBookmarkSections()` 整批隱藏 tab-item / tab-group-header / other-window-folder / reading-list-item，書籤改由 `filterBookmarks(keywords, regexes, tags)` 的 AND 邏輯篩選；清除查詢時自動還原。
- **T3 — commandPalette/searchContext + panelBridge**：`modules/commandPalette/searchContext.js`（originWindowId 跨模組共享）；`modules/commandPalette/panelBridge.js`（`requestPanelAction` 寫入 `chrome.storage.session.pendingPanelAction`；`openUrlInOrigin` 作用於來源 normal 視窗）。
- **T4 — Spotlight 頁面 + controller**：`spotlight.html`（`spotlight-body`/`spotlight-shell`/`#spotlight-input`/`#spotlight-results`）；`spotlight.js`（bootstrap：i18n / theme / stateManager / workspaceManager / originWindowId）；`modules/spotlight/spotlightController.js`（`initSpotlight`：監聽 input debounce→`searchAll`→`renderGroups`；ArrowUp/Down/Enter keyboard nav；Escape 關視窗）。
- **T5 — background open/close**：`background.js` 處理 `open-search` 命令，以 `chrome.windows.getLastFocused({windowTypes:['normal']})` 取來源視窗、存 `spotlightOriginWindowId` 到 session，`chrome.windows.create({type:'popup', width:640, height:480})` 置中開啟；`findExistingSpotlight` + `spotlightCreating` 防重入/避免重複開窗；`chrome.windows.onFocusChanged`（排除 `WINDOW_ID_NONE`）失焦自動關閉、`onRemoved` 清 id。
- **T6 — 側邊欄消費 + 舊 overlay 移除**：`sidepanel.js` 加 `PANEL_ACTION_HANDLERS`（9 個動作）+ `consumePendingPanelAction`（初始化後才消費，防 race）；`chrome.storage.session.onChanged` 監聽即時轉送；移除舊 `#command-palette-overlay`、`initCommandPalette` 所有相關 HTML/JS/CSS。
- **T7 — CSS**：`sidepanel.css` 加 `.spotlight-body`/`.spotlight-shell`/`.cmd-palette-input`/`.cmd-palette-results`/`.cmd-palette-group-header`/`.cmd-palette-row`/`.cmd-palette-row.active`/`.cmd-palette-meta`/`.cmd-palette-icon`/`.cmd-palette-empty`/`.cmd-palette-title`/`.cmd-palette-subtitle`；移除已刪除的 overlay 樣式。
- **T8 — build + i18n**：`Makefile` 加 `spotlight.html`/`spotlight.js` 進 zip 清單與 esbuild bundle（prod：去 `type="module"` sed、minify 14.2KB）；`manifest.json` 加 `open-search` 命令（Cmd+Shift+K）；`_locales/*/messages.json` × 14 語系補 `commandOpenSearch` 等缺漏 key。
- **T9 — E2E + 本筆記**：`usecase_tests/puppeteer_tests/happy_path_spotlight_search.test.js`（4 個測試，詳見下方）；本筆記。

## E2E 覆蓋（T9）

`happy_path_spotlight_search.test.js` 共 4 個測試：

1. **Spotlight 頁載入**：`page.goto(spotlightUrl)`，等 `#spotlight-input` + `#spotlight-results` + `.cmd-palette-group-header` 出現（空白查詢 → Actions 群組必有至少 1 個 header）。
2. **輸入篩選**：在 `#spotlight-input` 輸入 `"bookmark"` 觸發 debounced refresh，等 `#spotlight-results.children.length > 0`，斷言 `.cmd-palette-row` 至少 1 個。
3. **tag: 範圍限縮**：在側邊欄 seed 帶標籤書籤 + 無標籤書籤 → 輸入 `tag:SpotlightTag` → `waitForFunction` 等到帶標籤書籤在 DOM 且無標籤書籤消失 → 斷言所有 `.tab-item` 含 `hidden` class + 所有 `.reading-list-item`（若有）含 `hidden` → 清除查詢 → 斷言 tab-item 有元素不含 `hidden`。
4. **舊 overlay 移除**：在側邊欄斷言 `document.getElementById('command-palette-overlay') === null`。

**未覆蓋 / 說明**：
- 真實 OS 層 Cmd+Shift+K（headless Puppeteer 無法注入 OS 級快捷鍵，harness 限制，手動驗證見後續）。
- Spotlight popup 開啟本身的 DevTools（DevTools 附加到 popup 會使其 blur 而自行關閉，屬設計特性，不適合 E2E）。

## 已知 Minor（非阻斷，延續自 T2/T6 review）

- **T2 M2**：`tag:` 查詢以 `hideNonBookmarkSections()` 整批 add hidden 至 tab/reading-list 元素，但 section 層的 header/divider（`.section-header`、`.divider` 等）未同步隱藏，可能留下空白間距。UX follow-up，非功能 bug。
- **多螢幕置中**：Spotlight popup 以 `chrome.windows.getLastFocused({windowTypes:['normal']})` 的座標計算置中，`Math.max(origin.left/top, …)` 以來源視窗為下限避免被推回主螢幕；多螢幕排列時精準度 best-effort。
- **Spotlight DevTools 問題**：popup 視窗失焦即關閉（blur 自動關），故對 Spotlight 視窗打開 DevTools 時視窗會立刻關閉，為設計取捨（popup type 特性），已文件化。
- **真實 Cmd+Shift+K E2E 缺口**：如上述，harness 限制，需手動驗證（見後續）。
- **孤兒 i18n key**：移除面板內 palette overlay 的 hint footer 後，`cmdPaletteHintNavigate` / `cmdPaletteHintSelect` / `cmdPaletteHintClose` 已無程式引用（14 語系仍保留）。無害死資料，可選清理。

## 驗證 / 狀態

- `npm run test:unit`：**232 綠 / 14 套件**。
- `npm run test:ci`：**53 綠 / 21 套件**（含新 `happy_path_spotlight_search` 4 tests）。
- `npm run test:full`（×2 run）：**41 passed / 2 skipped（pre-existing） / 0 failed；106 tests**，兩次結果一致（穩定）。
- `make`（dev）→ `arc-sidebar-v1.14.3-dev.zip` OK。
- `make release`（prod）→ `arc-sidebar-v1.14.3.zip` OK（spotlight.js bundle 14.2KB）。
- `make clean` 完成，無 build artifact 殘留。

## 後續

1. **手動驗證 Cmd+Shift+K**：在真實 Chrome 分別於 `chrome://newtab`、`chrome://extensions`（受限頁無效，正常）、一般網頁（`https://example.com`）觸發快捷鍵，確認 popup 正確開啟 + 搜尋 + Enter 執行。
2. **Rebase + PR**：`git rebase main`（若有 main 更新）→ 開 PR `feat/spotlight-search` → main，使用 `pull-request` skill 產出雙語描述。
3. **T2 M2 follow-up**（可選）：視 UI 品質決定是否補 `section-header`/`divider` 的隱藏邏輯。

---

## 追記 — 修正 Cmd+Shift+K 在全螢幕下失效（gesture-first fallback）

### 症狀
接手 PR#151 後發現:`21766ed`(全螢幕 fallback commit)之後,Cmd+Shift+K「開啟搜尋」在
macOS 原生全螢幕(綠燈)下完全無反應。

### 根因
`chrome.sidePanel.open()` 需要 user gesture,而 **MV3 service worker 中 `chrome.commands.onCommand`
的 user activation 無法穩定撐過 `await`**(Chromium 已知限制:~127 回歸、128/129+ 修復,官方建議
永不依賴)。`21766ed` 的全螢幕分支在 `await getLastFocused` + `await storage.session.set` 兩個 await
之後才呼叫 `sidePanel.open` → gesture 已失效 → reject 被外層 `catch` 靜默 `console.warn` 吞掉 →
使用者看到「快捷鍵沒反應」。macOS 綠燈全螢幕為常見預設,故全螢幕使用者幾乎每次都中招。
(非全螢幕走 `chrome.windows.create` popup,不需 gesture,不受影響。)

### 修法(`background.js` / `sidepanel.js`)
- **gesture-first**:`openSpotlight()` 改為**非 async**,由 `onCommand` **同步呼叫(其前不可有 await)**。
  全螢幕分支以**同步可得的記憶體快取** `lastFocusedNormal`(由 `chrome.windows.onFocusChanged`
  維護:查 `windows.get(winId)`、只快取 `type==='normal'`、記 `id` 與 `fullscreen`)判斷全螢幕,
  讓 `sidePanel.open` 能在任何 await 之前同步呼叫;`storage.session.set(pendingSearchFocus)` 採
  fire-and-forget(不 await)。非全螢幕委派給 `openSpotlightPopup()`(原 popup 邏輯原封保留)。
- **失敗保護**:`sidePanel.open` 若 reject → 清除旗標 + 退回 popup,確保快捷鍵不會靜默無反應。
- **自我修正**:`openSpotlightPopup()` 與全螢幕分支 open 後皆 `refreshLastFocusedNormal()`,
  讓 stale 快取(冷啟動首按、悄悄離開全螢幕無 focus 變更)於次按修正。
- **TTL 過期保護**:`sidepanel.js` `consumePendingSearchFocus` 加 `SEARCH_FOCUS_TTL_MS=10000`,
  丟棄先前失敗 open 殘留的舊旗標,避免下次開側邊欄誤搶焦點。

### 已知取捨(對抗式 review 確認,皆自限、非阻斷)
- **冷啟動 SW 首按**:快取為初始值,全螢幕使用者首按落 popup(可能跳 Space),次按修正。
  仍**優於修正前「完全無反應」**。
- **stale-true**:離開全螢幕未觸發 onFocusChanged 時,下次開側邊欄而非 popup(等效搜尋入口);
  open 後的 refresh 會於再次按鍵修正。

### 驗證
- `node --check`/esbuild parse 兩檔 OK;`test:unit` 232→236 綠(含原 4 spotlight E2E);
  `npm test`(full)**41 passed / 2 skipped / 0 failed,106 tests**;`make` dev build OK。
- **仍需手動驗證**:真實 Cmd+Shift+K(headless 無法注入 OS 快捷鍵)——請於 macOS **全螢幕**
  與**非全螢幕**各觸發:全螢幕應開側邊欄並聚焦搜尋框、非全螢幕應開置中 popup。
