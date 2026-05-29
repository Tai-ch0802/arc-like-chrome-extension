# NOTE 2026-05-29 — Phase 12 / 批 D：設定 dialog → 獨立 options page

## 背景
近期大改後修正計畫 4 批，本筆記為**批 D**（最後一批；A/B/C 已合併）。
- ✅ 批 A：書籤貼 label + 局部目錄掃描。
- ✅ 批 B：死連結資料夾路徑 + AI 分頁清理 group badge。
- ✅ 批 C：切換工作區還原 tab group。
- ✅ 批 D（本批，已完成）：設定 dialog 全面遷移到獨立 options page（#6）。
- ⏳ #5 分頁內容跨裝置同步：另開一批，用 Google Drive 持久層（見 memory `workspace-sync-google-drive-direction`）。設定頁已就緒，帳號連結 UI 可放這。
- ⏳ 未排程：AI 書籤整理。

文件：spec `docs/superpowers/specs/2026-05-29-settings-options-page-design.md`；plan `docs/superpowers/plans/2026-05-29-settings-options-page.md`。

## 做了什麼
- **manifest**：加 `options_ui` + `open_in_tab: true`。
- **options.html / options.css / options.js**：左側導覽 7 區塊（外觀/語言/功能顯示/AI 與實驗/RSS/快捷鍵/關於）。重用既有 manager（customThemeManager/backgroundImageManager/rssManager/aiManager）。options.html 同時 link sidepanel.css（共用元件樣式）+ options.css（頁面版面）。
- **跨 context 傳播** `modules/ui/settingsBridge.js`：純函式 `resolveSettingChangeActions` 把 `chrome.storage.onChanged` 映射成 action；`applySettingChanges` 執行（套主題/自訂主題/背景、語言 reload、dispatch 既有可視性 CustomEvent、**refreshState 刷新 stateManager 模組快取**）。`initSettingsBridge` 在 sidepanel 掛載。控制項只 setStorage、不 dispatch（options 與 sidepanel 是不同 context）。
- **settingManager.js**：818 → 52 行。保留 `applyTheme` + `initThemeSwitcher`（載入套用主題/背景；齒輪改 `chrome.runtime.openOptionsPage()`）。移除整個 dialog（buildSettingsDialogContent/bindSettingsEventHandlers/renderRssList/detectAiModelStatus/getStatusBadge）。
- **Makefile**：dev 清單加 options.*；prod 用 esbuild bundle options.js、minify options.css、cp+strip type=module。
- **i18n**：7 個 nav key × 14 語系。

## 關鍵發現 / 設計備忘
- **bridge 完整性**：stateManager 把 hover/RLsummary/autoNaming/可視性等存成模組快取變數、consumer 讀快取。bridge 必須對這些 key 呼叫對應 `initX()`（唯讀、不寫 storage → 無 onChanged 迴圈）刷新快取，否則 options page 改了要 reload 才生效（commandPalette 讀 isAiGroupingVisible() 等亦受影響）。
- **openOptionsPage 需 trusted user gesture**：E2E 要用真實 `page.click` 而非 `page.evaluate(el.click())`（後者是 untrusted、no-op）。
- **意外收穫**：舊 `happy_path_settings_panel` 與 `happy_path_theme_switch` 之所以一直出現「偶發 retry」，根因是它們測的是舊 in-sidepanel dialog 且用程式化 click（被 jest retryTimes 遮蔽）。本批移除 dialog 後一併改寫成測 options page，現在零 retry 通過。
- jest.setup.js 加了 guarded chrome stub（settingsBridge 的 import graph 在 node 載入時觸及 readingListManager 頂層的 chrome.i18n）；僅當 globalThis.chrome undefined 注入，不影響 puppeteer。

## 測試 / 狀態
- 單元 91 綠（新增 settingsBridge 11 例）。
- E2E：新增 `happy_path_options_page`（nav/切換/toggle 持久化）；改寫 `happy_path_settings_panel`（齒輪開 options page）與 `happy_path_theme_switch`（options 換主題 → sidepanel 經 bridge 反映 + reload 持久）。
- `npm run test:ci` 18 套件 43 測試全綠、零 retry；`make` + `make release` 皆 OK，zip 含 options.*。
- 分支 `feat/settings-options-page`，多個實作 commit；尚未 merge。
