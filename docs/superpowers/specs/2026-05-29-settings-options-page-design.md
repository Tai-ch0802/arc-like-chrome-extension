# 批 D 設計：設定 dialog → 獨立 options page

- **日期**：2026-05-29
- **狀態**：設計已核可，待寫實作計畫
- **範圍**：近期大改後修正第 4 批（#6）。把 sidepanel 內的設定 dialog 全面遷移到獨立 HTML options page。
- **決策（使用者拍板）**：全面遷移（齒輪鈕改開 options page、移除 inline dialog）；`options_ui` + `open_in_tab: true`（全分頁）；左側導覽 + 區塊 IA。

---

## 1. 問題

`modules/ui/settingManager.js`（818 行）把約 16 類設定全部塞進 sidepanel 內的一個 modal dialog，資訊過載、難維護、且窄面板不適合。

## 2. 目標

- 新增獨立 options page（`options.html` + `options.js` + 樣式），以**左側導覽 + 內容區塊**呈現所有設定。
- 齒輪鈕 `settings-toggle` 改為 `chrome.runtime.openOptionsPage()`，在新分頁開啟。
- 移除 sidepanel 內的設定 dialog。
- 設定在 options page 變更後，**sidepanel 即時反映**（透過 `chrome.storage.onChanged` 橋接，取代原本同文件的 CustomEvent dispatch）。

### 非目標
- 不改設定的儲存格式/key（沿用既有 chrome.storage sync/local）。
- 不新增設定項（純遷移 + 重新編排）。
- 不做 #5 分頁跨裝置同步（之後另開一批，Google Drive 方向）。

## 3. 現況事實（已驗證）

| 項目 | 事實 | 出處 |
|------|------|------|
| dialog 建構 | `buildSettingsDialogContent(theme)` 動態建整個 modal DOM | `settingManager.js:35-343` |
| 事件綁定 | `bindSettingsEventHandlers`：toggle/select 變更 → `setStorage` + `document.dispatchEvent(CustomEvent)` | `:344-...` |
| 語言變更 | `window.location.reload()` | `:408-411` |
| RSS 清單 | `renderRssList` 在 dialog 內 | `:482-...` |
| AI 模型偵測 | `detectAiModelStatus` 在 dialog 內 | `:705-784` |
| 齒輪鈕 + 載入套用主題 | `initThemeSwitcher`：綁 modal + 載入時 applyTheme/背景 | `:785-817` |
| sidepanel 接收事件 | `readingListVisibilityChanged`(sidepanel.js:299)、`aiGroupingVisibilityChanged`(aiGrouperUI.js:21)、`aiCleanupVisibilityChanged`(aiCleanupUI.js:30)、`readingListUpdated`(sidepanel.js:304) | — |
| 既有跨 sidepanel 同步 | `stateManager.subscribeToStorageChanges` 只處理 `local` 區 linkedTabs/windowNames | `stateManager.js:561-574` |
| manifest | **無** options_ui/options_page | `manifest.json` |
| 設定 key（sync） | theme, customTheme, backgroundImageConfig, uiLanguage, readingListVisible, aiGroupingVisible, aiAutoNamingEnabled, aiCleanupVisible, hoverSummarizeEnabled, readingListSummaryEnabled, rssSubscriptions | — |
| 設定 key（local） | custom_bg_image_data, rssFetchedHashes, rssFetchFailures | — |
| 業務邏輯 manager | customThemeManager / backgroundImageManager / rssManager / aiManager 皆 context-agnostic（走 chrome.storage），可在 options page 重用 | — |
| CSP | `script-src 'self'` 套用於擴充頁面（含 options.html） | `manifest.json:23` |

## 4. 設計

### 4.1 manifest

新增：
```json
"options_ui": { "page": "options.html", "open_in_tab": true }
```

### 4.2 options.html / options.css

- `options.html`：左側導覽（外觀 / 語言 / 功能顯示 / AI 與實驗 / RSS / 快捷鍵 / 關於）+ 右側內容區。載入 `options.js`（type=module）。符合 CSP（自家 script）。
- 樣式：新增 options 專屬樣式（可獨立 `options.css`，或沿用 sidepanel.css 的共用元件 class）。本設計採**獨立 options.css**，避免把 sidepanel 樣式整包帶進來；共用的小元件（toggle、select、color swatch）視需要複製必要規則。
- options page 自身也套用使用者主題（載入時讀 theme/customTheme 套用），保持一致觀感。

### 4.3 options.js（頁面控制器）

- 建立左側導覽 + 區塊切換（左 nav 點擊顯示對應 section；預設第一個）。
- 各 section 重用既有 manager 的業務邏輯，重新編排成頁面版面：
  - **外觀**：主題下拉（含 custom）、自訂主題面板（`customThemeManager`）、背景圖片（`backgroundImageManager`）。
  - **語言**：UI 語言下拉。
  - **功能顯示**：reading list / AI 分組 / AI 清理 / AI 自動命名 / hover 摘要 / RL 摘要 toggles。
  - **RSS**：訂閱清單 CRUD（`rssManager`，重用 `renderRssList` 的邏輯，改頁面版面）。
  - **AI 與實驗**：AI 模型狀態偵測（`detectAiModelStatus` 邏輯）+ 下載/設定指南。
  - **快捷鍵**：顯示 Chrome 快捷鍵 + 連到 `chrome://extensions/shortcuts`。
  - **關於**：官網/GitHub 連結。
- 控制項變更：只 `setStorage`（**不再 dispatch 同文件 CustomEvent**）；propagation 由 4.5 的 bridge 在 sidepanel 端處理。options page 自身需即時反映的部分（如主題、自訂主題、背景圖預覽）在 options page 自己套用。
- i18n：沿用既有 message key（dialog 既有字串可直接重用）；新增的 nav 標題等少量 key 補進 `_locales`。

### 4.4 settingManager.js 精簡

- **保留**：`applyTheme`、載入時套用 theme/customTheme/背景（sidepanel 啟動仍需）。
- 把 `initThemeSwitcher` 拆成：
  - 載入套用主題/背景（保留於 sidepanel 初始化）。
  - 齒輪鈕 handler 改為 `chrome.runtime.openOptionsPage()`（不再開 modal）。
- **移除**：`buildSettingsDialogContent`、`bindSettingsEventHandlers`、dialog 內的 RSS 渲染與 AI 偵測（其邏輯遷往 options.js；共用部分抽成 module 由兩邊 import 亦可，但本批以「options.js 自帶、settingManager 移除」為主，避免過度抽象）。

### 4.5 Propagation bridge（sidepanel 端，核心整合）

新增一個 `chrome.storage.onChanged` 監聽（放在 sidepanel 初始化或 settingManager），watch 設定 key 並讓 sidepanel 即時反映：

| 變更 key（area） | sidepanel 反應 |
|---|---|
| `theme`(sync) | `applyTheme(newValue)`（custom 則 `customTheme.loadAndApplyCustomTheme()`） |
| `customTheme`(sync) | `customTheme.loadAndApplyCustomTheme()` |
| `backgroundImageConfig`(sync) / `custom_bg_image_data`(local) | `bgImage.loadAndApplyBackgroundImage()` |
| `uiLanguage`(sync) | `window.location.reload()` |
| `readingListVisible`(sync) | dispatch `readingListVisibilityChanged`（沿用既有 listener） |
| `aiGroupingVisible`(sync) | dispatch `aiGroupingVisibilityChanged` |
| `aiCleanupVisible`(sync) | dispatch `aiCleanupVisibilityChanged` |
| `hoverSummarizeEnabled` / `readingListSummaryEnabled`(sync) | 重新 init 對應 state 快取（`state.set*` / re-init），使下次行為用新值 |

- 設計成**冪等**：onChanged 也會被同 sidepanel 自身寫入觸發，但 sidepanel 已不再寫設定（設定只在 options page 寫），故主要來源是 options page；重複套用無害。
- 抽成可測的純邏輯：`resolveSettingChangeActions(changes, areaName)` → 回傳要執行的 action 清單（key→action 標籤），UI 端據以執行。可單元測試「哪些 key 觸發哪種 action」。

### 4.6 齒輪鈕

`settings-toggle` click → `chrome.runtime.openOptionsPage()`。若 API 不存在（極舊環境）則 fallback 開 `options.html`（`chrome.runtime.getURL`）。

## 5. 影響面

- 新增：`options.html`、`options.js`、`options.css`、manifest `options_ui`。
- 改動：`settingManager.js`（精簡）、sidepanel 初始化（掛 bridge）、`stateManager`（可能擴充 onChanged 或新增 bridge 模組）。
- i18n：少量新 key（nav 標題等）；設定字串大多沿用。
- Makefile/打包：確認 `options.html`/`options.js`/`options.css` 被納入 zip（檢查 `make` 的檔案清單）。
- 不影響：設定儲存格式、各 manager 的業務邏輯。

## 6. 邊界與安全
- options page 與 sidepanel 是不同 context；唯一通訊管道是 chrome.storage（+ onChanged）。不可依賴同文件 CustomEvent 跨 context。
- 語言變更只 reload sidepanel；options page 自身可選擇是否 reload（次要）。
- 移除 dialog 後，務必確認沒有其他地方還 import 被移除的函式（grep `buildSettingsDialogContent` 等）。
- CSP：options.html 只 load 自家 `options.js`，無 inline script。

## 7. 測試策略
- 單元：`resolveSettingChangeActions(changes, areaName)`（各 key→action 對映、非設定 key 不觸發、local vs sync 區分）。
- E2E（Puppeteer）：
  - options page 載入：開 `options.html`（或經 openOptionsPage），斷言左側 nav 與各 section 渲染、主題下拉等控制項存在。
  - 設定持久化 + 傳播：在 options page 改一個 toggle（如 reading list 顯示）→ 斷言 `chrome.storage` 寫入；並（若 harness 可同時持有 sidepanel）驗證 sidepanel 經 bridge 反映。傳播跨 context 在 E2E 較難，務實做法：直接測 options page 寫入 + 對 `resolveSettingChangeActions` 單元測試覆蓋傳播邏輯。
- 迴歸：`npm run test:ci` 既有 happy path 不破壞（特別是 settings_panel 測試——它測的是舊 dialog，遷移後需更新或改為測 openOptionsPage 行為）。

> 注意：既有 `happy_path_settings_panel.test.js` 斷言點擊齒輪會出現 `.modal-overlay` 設定 dialog。本批移除該 dialog 後，這個測試會失效，**必須一併更新**為「點齒輪會呼叫 openOptionsPage / 開 options.html」。實作計畫含此項。

## 8. 後續（備忘）
- #5 分頁跨裝置同步：本批之後，用 Google Drive 持久層另開一批（同步帳號連結 UI 可放進本批新建的 options page）。
- 未排程：AI 書籤整理。
