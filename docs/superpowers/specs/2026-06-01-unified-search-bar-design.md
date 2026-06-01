# 統一搜尋:置中 Spotlight 彈出視窗 + 全域 Cmd+Shift+K + filter 重構

- **日期**：2026-06-01
- **狀態**：設計已核可（含 9 動作全做、彈出視窗、Spotlight 專責引導）
- **分支**：`feat/spotlight-search`（從最新 main）
- **背景**：專案同時存在「側邊欄搜尋 bar（原地過濾已渲染清單）」與「命令面板（側邊欄內 Cmd+K overlay、結果清單模型）」，兩者使用上重疊。命令面板刻意不走 manifest（Chrome 把 Ctrl+K 綁網址列），且只在側邊欄已開且有焦點時可用。

## 目標
1. **全域 Cmd+Shift+K**：不論側邊欄開關，按下即在 Chrome 畫面正中央彈出一個「Spotlight 搜尋視窗」並顯示引導建議（類 macOS Spotlight）。
2. **Spotlight = 引導/動作中心**：重用命令面板的資料層與動作（分頁/書籤/閱讀清單/工作區 + 9 個內建動作），空白時顯示引導預設、打字即時過濾、方向鍵 + Enter 執行。
3. **移除側邊欄內的命令面板 overlay**，統一入口。
4. **filter 重構**：側邊欄搜尋 bar 維持原地過濾與樣式；`tag:` 查詢只作用書籤、其餘區塊隱藏；收斂分散的 filter 邏輯。

### 非目標
- 不做網頁就地覆蓋層（content script 注入）——已選彈出視窗路線。
- NL/AI 搜尋維持為獨立 action（`nlSearch.js` 不併入增量打字流）。
- 側邊欄搜尋 bar **不**新增建議下拉（引導建議集中在 Spotlight）。
- 不改標籤資料結構、不動 Drive 同步。

## 關鍵技術決策（已拍板）

| 決策 | 選擇 | 理由 |
|------|------|------|
| 置中搜尋實作 | **獨立彈出視窗** `chrome.windows.create({type:'popup'})` | 任何畫面可用（含 `chrome://`/新分頁/PDF）、不需網頁權限、不受網站 CSP 影響、樣式隔離、可重用命令面板 UI。macOS Spotlight 本質即一個視窗。 |
| 快捷鍵 | `Command+Shift+K` / `Ctrl+Shift+K` | 避開 Chrome 對 Ctrl+K（網址列搜尋引擎切換）的潛在衝突；使用者仍可於 `chrome://extensions/shortcuts` 改綁。 |
| 引導建議分工 | Spotlight 專責；側邊欄 bar 只保留原地過濾 + 修 tag: 範圍 | 不重複維護兩個出現點。 |
| 動作範圍 | 全 9 個 | 側邊欄 UI 類動作走「旗標 + 側邊欄消費」轉送。 |

## 現況事實（已驗證）

| 項目 | 事實 | 出處 |
|------|------|------|
| 命令面板自包含 | 自有 overlay DOM + `document` 級 Cmd+K 監聽（sidepanel-scoped），刻意不走 manifest | `commandPalette/index.js` |
| 資料層 | `searchAll(query)` 聚合 actions/workspaces/tabs/bookmarks/reading-list，空查詢回各組 top 8 | `commandPalette/dataProvider.js` |
| 動作清單（9） | smart-group/ai-cleanup/new-tab-right/refresh-bookmarks/settings/create-workspace/manage-workspaces/bookmark-tools/ask-ai-search | `commandPalette/actions.js` |
| 動作多為 DOM 點擊 | 例：`document.getElementById('ai-group-btn')?.click()`、`settings-toggle`、`workspace-manage-btn`、`bookmark-tools-btn`、`ai-cleanup-btn` | `commandPalette/actions.js` |
| NL 搜尋為獨立 action | 只由 `action-ask-ai-search` 觸發，自有 prompt+結果 modal，與增量搜尋分離 | `commandPalette/nlSearch.js` |
| 側邊欄搜尋為原地過濾 | `handleSearch` parse → `{keywords,tags}`；分頁/群組/其他視窗/閱讀清單只吃 keywords，書籤吃 keywords+tags | `searchManager.js` |
| 空 keyword = 全匹配 | `matchesAnyKeyword(text, [])` 回 `true`（故清空還原全顯示；tag 查詢「隱藏分頁」不能靠傳空 keyword） | `searchUtils.js:27` |
| 既有獨立擴充頁範本 | `options.html`：`<link sidepanel.css>` + `<script type="module">`；bootstrap = `applyOwnTheme()`（讀 `storage.sync.theme`，custom→`loadAndApplyCustomTheme` 否則 `applyTheme`）+ `[data-i18n]` 走訪 `api.getMessage` | `options.html` / `options.js:1199-1239` |
| build | dev 整包 `cp -R` DEV_SRC_FILES；prod 各檔 `esbuild --bundle --minify` + `cp html` + `sed` 去 `type="module"` | `Makefile` |
| 動作目標按鈕存在側邊欄 | `ai-group-btn`/`ai-cleanup-btn`/`settings-toggle`/`workspace-manage-btn`/`bookmark-tools-btn` | `sidepanel.html` |

## 設計

### A. Spotlight 彈出視窗（新擴充頁 + 開窗/關窗）

- **新增** `spotlight.html`（仿 `options.html`）：`<link rel="stylesheet" href="sidepanel.css">`（沿用主題變數與 `.cmd-palette-*` 樣式）、容器（input + results）、`<script type="module" src="spotlight.js">`。**不另建 CSS 檔**，Spotlight 專屬版面樣式併入 `sidepanel.css`。
- **新增** `spotlight.js`（bootstrap，仿 `options.js`）：`DOMContentLoaded` → `applyOwnTheme()`（同 options 的讀 theme/custom 邏輯）+ `[data-i18n]` localize + 初始化 `spotlightController`。
- **新增** `modules/spotlight/spotlightController.js`：重用 `commandPalette/dataProvider.js`（`searchAll`）與列渲染/方向鍵/`aria-activedescendant`/Enter 執行邏輯（從 `commandPalette/index.js` 萃取共用，見 D 段），渲染進 `spotlight.html` 的容器。Esc 或執行後 `window.close()`。
- **`manifest.json`**：`commands` 新增
  ```json
  "open-search": {
    "suggested_key": { "default": "Ctrl+Shift+K", "mac": "Command+Shift+K" },
    "description": "__MSG_commandOpenSearch__"
  }
  ```
  不需新權限、不需 `web_accessible_resources`（彈出視窗直接載入擴充頁，非注入網頁）。
- **`background.js`**：
  - `chrome.commands.onCommand` 分派加 `open-search` → `openSpotlight()`：
    - 若 `spotlightWindowId` 仍有效 → `chrome.windows.update(spotlightWindowId, {focused:true})`。
    - 否則計算置中座標：`const w = await chrome.windows.getLastFocused({windowTypes:['normal']})`；`left = w.left + Math.round((w.width - WIDTH)/2)`、`top = w.top + Math.round((w.height - HEIGHT)/3)`（偏上、較像 Spotlight）；找不到 normal 視窗則省略 left/top。`chrome.windows.create({url: chrome.runtime.getURL('spotlight.html'), type:'popup', focused:true, width:WIDTH, height:HEIGHT, left, top})` → 存回 `spotlightWindowId`。`WIDTH≈640`、`HEIGHT≈480`。
  - 失焦自動關閉：`chrome.windows.onFocusChanged(id => { if (spotlightWindowId && id !== spotlightWindowId && id !== chrome.windows.WINDOW_ID_NONE) chrome.windows.remove(spotlightWindowId).catch(()=>{}); })`。
  - `chrome.windows.onRemoved(id => { if (id === spotlightWindowId) spotlightWindowId = null; })`。
  - SW 被殺後 `spotlightWindowId` 會遺失：`openSpotlight` 先以 `chrome.windows.getAll({windowTypes:['popup']})` + url 比對嘗試找回既有 Spotlight，避免開出第二個（best-effort；找不到就開新的）。

### B. 動作轉送（9 個全做）

`commandPalette/actions.js` 的 handler 依類型改寫，使其在獨立視窗也能運作：

- **純 API / 導航類**（在 Spotlight 視窗內直接執行，擴充頁有 `chrome.*`）：
  - `new-tab-right`：維持 `chrome.tabs` API（已是純 API）。
  - `settings`：改為 `chrome.runtime.openOptionsPage()`（不再點 `settings-toggle`）。
  - tabs/bookmarks/reading-list/workspaces 導航項：維持 dataProvider 內既有 handler（`tabs.update`/`tabs.create`/`requestSwitchTo`）。`create-workspace` 評估：若 `createWorkspaceFromCurrent` 依賴側邊欄 DOM/state 則歸類為側邊欄類（走轉送）；否則直接呼叫。**實作時先讀其相依**，預設安全起見走轉送。
- **側邊欄 UI 類**（走轉送）：`smart-group`、`ai-cleanup`、`bookmark-tools`、`manage-workspaces`、`refresh-bookmarks`、`ask-ai-search`、（必要時）`create-workspace`。
  - handler 改呼叫共用 `requestPanelAction(id)`：寫 `chrome.storage.session.set({ pendingPanelAction: { id, ts } })` + 開側邊欄（`chrome.windows.getLastFocused({windowTypes:['normal']})` → `chrome.sidePanel.open({windowId})`；點擊為使用者手勢）→ `window.close()`。
- **側邊欄消費**（`sidepanel.js`）：
  - init 與 `chrome.storage.session.onChanged` 皆檢查 `pendingPanelAction` → 依 `id` 對映既有按鈕/事件並觸發（沿用現行 handler 的點擊/CustomEvent），完成後清旗標。
  - 對映表集中於 `sidepanel.js`（或新 `modules/panelActions.js`）：`ai-group→#ai-group-btn.click()`、`ai-cleanup→#ai-cleanup-btn.click()`、`bookmark-tools→#bookmark-tools-btn.click()`、`manage-workspaces→#workspace-manage-btn.click()`、`refresh-bookmarks→dispatch refreshBookmarksRequired`、`ask-ai-search→import nlSearch.openAskAiDialog()`、`create-workspace→workspaceUI.createWorkspaceFromCurrent()`。
  - **可見性一致性**：轉送前在 Spotlight 端沿用既有 `isVisible()` 過濾（停用功能的動作不顯示），消費端不必再判。

> 設計取捨：Spotlight 對「側邊欄 UI 類」動作不在自身視窗執行，而是開側邊欄 + 觸發；對使用者表現為「Spotlight 收起 → 側邊欄打開並執行」。AI 類動作的進度本就顯示在側邊欄，符合預期。

### C. 移除側邊欄命令面板 overlay

- `sidepanel.html`：移除 `#command-palette-overlay` 整塊 markup。
- `sidepanel.js`：移除 `initCommandPalette` import 與呼叫。
- `commandPalette/index.js`：移除全螢幕 overlay 與 `document` 級 Cmd+K/Ctrl+K 監聽。其可重用的列渲染/導航/執行邏輯萃取為共用（D 段）供 `spotlightController` 使用；本檔可改為僅匯出共用 helper 或刪除。
- 確認無殘留 import / dead CSS（`.cmd-palette-overlay` 若僅 overlay 用則清掉，列/群組樣式保留給 Spotlight）。

### D. 共用渲染/導航 helper

將 `commandPalette/index.js` 內與「容器無關」的邏輯（`buildRow`、群組渲染、`setActive`/`moveActive`、`executeActive`、鍵盤導航）萃取為可注入容器的 helper（例如 `modules/commandPalette/paletteView.js` 或併入 `spotlightController`），讓 Spotlight 重用而不重寫。原 overlay 專屬（開關、焦點還原、backdrop）不保留。

### E. filter 重構（`searchManager.js` + `searchUtils.js`）

- **新增純函式** `searchScope({ keywords, tags })` → `{ filterPanelSections: boolean }`：`tags.length > 0` → `filterPanelSections=false`（tag 查詢只作用書籤）。可單元測試。
- **`handleSearch`** 改為：
  ```
  const { keywords, tags } = parseSearchQuery(value);
  const { filterPanelSections } = searchScope({ keywords, tags });
  if (filterPanelSections) {
      tabCount      = filterTabsAndGroups(keywords);
      otherWinCount = filterOtherWindowsTabs(keywords);
      rlCount       = filterReadingList(keywords, regexes);
  } else {
      hideNonBookmarkSections();   // 全隱藏分頁/群組/其他視窗/閱讀清單
      tabCount = otherWinCount = rlCount = 0;
  }
  bookmarkCount = await filterBookmarks(keywords, regexes, tags);
  ```
- **新 helper** `hideNonBookmarkSections()`：用既有元素快取（`getTabElementsCache`/`getOtherTabElementsCache`/group/window folder caches + `#reading-list .reading-list-item`）toggle `.hidden`、收合區塊；計數 0。切回關鍵字/空白時由既有 `filterTabsAndGroups(keywords)` 等重新評估而還原（空 keyword=全顯示）。
- **收斂**：把 reading-list 的 keyword 比對接上既有 `filterTabItem`/`matchesAnyKeyword` 共用路徑，去除重複；**不改既有函式對外契約**（降回歸風險）。

### F. 主題 / i18n / build

- `spotlight.html`/`spotlight.js` 套主題（同 options 的 `applyOwnTheme`）+ `[data-i18n]` localize，沿用 `cmdPalette*` 既有文案。
- 新 i18n key：`commandOpenSearch`（manifest command 說明）、視需要 `spotlightPlaceholder`/標題 × 14 語系（en 主檔 + 翻譯）。
- `Makefile`：DEV_SRC_FILES 加 `spotlight.html`、`spotlight.js`（CSS 併入 sidepanel.css，無新檔）；PROD 新增 `esbuild spotlight.js --bundle --minify`、`cp spotlight.html` + `sed` 去 `type="module"`（仿 options 兩行）。`modules/spotlight/` 隨 `modules` 整包複製，且被 `spotlight.js` bundle 涵蓋。
- `GEMINI.md` key_files：新增 `spotlight.html`/`spotlight.js`/`modules/spotlight/`、調整 commandPalette 用途描述。

## 影響面
- **新增**：`spotlight.html`、`spotlight.js`、`modules/spotlight/spotlightController.js`、（萃取）共用 paletteView helper。
- **改**：`manifest.json`（command + i18n）、`background.js`（openSpotlight + onFocusChanged/onRemoved + onCommand 分派）、`commandPalette/actions.js`（handler 改 API/轉送）、`commandPalette/index.js`（拆共用 / 去 overlay）、`sidepanel.html`（移除 overlay markup）、`sidepanel.js`（移除 initCommandPalette、加 pendingPanelAction 消費）、`searchManager.js`（filter 重構 + scope）、`searchUtils.js`（+`searchScope`）、`sidepanel.css`（Spotlight 版面 + 清 overlay 死碼）、`_locales/*`、`Makefile`、`GEMINI.md`。
- **不動**：`dataProvider.js`、`nlSearch.js`（原樣重用）、標籤資料層、Drive 同步。

## 風險與緩解
- **`sidePanel.open` 自 `commands.onCommand` / 自 Spotlight 點擊**：需使用者手勢，二者皆屬手勢情境；失敗 `console.warn` 不崩潰。**列手動驗證**。
- **SW 被殺遺失 `spotlightWindowId`**：`openSpotlight` 先用 `windows.getAll` + url 找回，避免重複開窗。
- **失焦關閉誤判**：排除 `WINDOW_ID_NONE`（短暫無焦點）；devtools/別視窗造成的關閉可接受（Spotlight 本就失焦即關）。
- **動作可見性繞過**：Spotlight 端沿用 `isVisible()` 過濾，停用功能的動作不顯示。
- **彈出視窗外觀**：`type:'popup'` 去網址列但仍是獨立視窗，開窗有瞬間感（已與使用者確認接受）。

## 測試策略
- **單元（TDD）**：`searchScope`（tag 有/無）；`parseSearchQuery`/`bookmarkMatchesTags` 不回歸。
- **E2E（Puppeteer）**：
  - 直接載入 `spotlight.html`：空白顯示「快速動作/工作區」等引導群組；打字過濾結果；選導航項觸發；選側邊欄類動作 → 寫入正確 `pendingPanelAction`。
  - 側邊欄：輸入 `tag:<name>` → 只剩該標籤書籤，分頁/群組/閱讀清單皆隱藏；清空 → 還原；`#command-palette-overlay` 為 `null`（舊 overlay 已移除）。
  - `pendingPanelAction` 消費：設旗標 → 側邊欄觸發對應動作。
- **手動**：真實 Cmd+Shift+K（於 `chrome://`、新分頁、一般網頁、無 normal 視窗各情境）；失焦自動關閉;`chrome://extensions/shortcuts` 改綁;9 動作逐一驗證（側邊欄類會開側邊欄並執行）。
- **建置**：`make`（dev，含 spotlight）、`make release`（prod，確認 spotlight bundle + manifest command 正確）。

## 後續備忘
- 完成後 `git rebase` 最新 main、提交 PR（雙語描述）。
- Drive 同步 OAuth live 測試仍待 owner（與本批無關）。
