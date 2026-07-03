---
description: 專案架構不變式與模組地圖
---

# 專案架構

> **檔案級職責說明的單一事實來源是 `GEMINI.md` 的 `key_files` 區塊**（歷史約定，持續維護）。
> 本 RULE 只保留「不會隨單一檔案增減而改變」的架構不變式與目錄級地圖，避免與 key_files 重複而 drift。

## 執行 Context（Manifest V3）

| 進入點 | Context | 說明 |
|---|---|---|
| `background.js` | Service Worker | 快捷鍵、sidePanel 行為、RSS alarms、workspace 生命週期、Drive sync 引擎。**隨時可能被終止**，不可依賴 in-memory 狀態存活。 |
| `sidepanel.js` | Side Panel 頁面 | 應用主入口：初始化各模組、串連瀏覽器事件。 |
| `options.js` | 獨立設定頁（open_in_tab） | 設定 UI；跨 context 變更靠 `chrome.storage.onChanged` + `settingsBridge` 傳播，不 dispatch CustomEvent。 |
| `spotlight.js` | 獨立 popup 視窗 | Spotlight 搜尋（Cmd+Shift+K）；經 `panelBridge` 以 `chrome.storage.session` 旗標與 sidepanel 溝通。 |
| `offscreen.js` | Offscreen Document | 需要 DOM 的背景工作。 |

## 架構不變式（改 code 前先確認沒有違反）

1. **Chrome API 一律經 `modules/apiManager.js` 封裝**。UI/業務模組不得直接呼叫 `chrome.*`（Service Worker 專屬邏輯除外），以利測試與集中錯誤處理。
2. **DOM 引用集中於 `modules/ui/elements.js`**；DOM 生成集中在 `modules/ui/*Renderer.js`。業務邏輯模組（stateManager 等）不碰 DOM。
3. **`modules/uiManager.js` 是 UI Facade**：對外重新匯出 `modules/ui/` 子模組，外部只 import facade。
4. **SVG 圖示集中於 `modules/icons.js`**（Material Symbols 系統），嚴禁散落硬編碼。
5. **可測試性優先**：純函式抽到 `modules/utils/` 或模組內獨立 export（不 import elements.js），單元測試才能在 Node/jsdom 跑。同步引擎（`modules/sync/`）採依賴注入，決策核心是純函式。
6. **跨 context 溝通有既定協定**：storage.onChanged（settingsBridge）、chrome.storage.session 旗標（panelBridge）、runtime messaging（Drive sync 指令）。新增跨 context 協定屬 **SDD T2**，先寫 spec。
7. **`chrome.storage` schema 變更屬 SDD T2**：sync 有 8KB/key 配額；workspace 採 per-id keys（`wsMeta_<id>`/`wsSnap_<id>`）。
8. **新增/改名檔案必須同步 `Makefile`**（`DEV_SRC_FILES` / prod esbuild 清單），否則 release zip 會漏包。

## 目錄級地圖

| 目錄 | 內容 |
|---|---|
| `modules/` 根層 | 單檔管理器：apiManager / stateManager / modalManager / dragDropManager / searchManager / keyboardManager / aiManager / rssManager / readingListManager / icons / uiManager |
| `modules/ui/` | 渲染與 UI 元件（tabRenderer、bookmarkRenderer、settingManager、settingsBridge、customThemeManager、backgroundImageManager、aiGrouperUI、aiCleanupUI、hoverSummarize*、contextMenu*、driveSyncBadge…） |
| `modules/ui/tab/` | 分頁事件監聽與 Split View 渲染 |
| `modules/commandPalette/` | Spotlight 資料層：dataProvider / actions / nlSearch / panelBridge / searchContext |
| `modules/spotlight/` | Spotlight 彈窗控制器 |
| `modules/workspace/` | workspaceManager（CRUD+儲存）/ workspaceLifecycle（SW 常駐快照與重綁）/ workspaceUI |
| `modules/bookmark/` | Bookmark Tools：tagManager / dedupe / deadLinkChecker / tagPicker / bookmarkUtils / bookmarkToolsUI |
| `modules/readingList/` | 閱讀清單摘要 summaryStore / summaryRecorder |
| `modules/sync/` | Google Drive 同步：syncProvider 介面 / driveAuth / googleDriveProvider / syncLogic（純函式）/ syncEngine（DI 編排） |
| `modules/utils/` | 純函式工具：colorUtils / imageUtils / textUtils / searchUtils / domUtils / functionUtils / iconUtils / pageContentExtractor |
| `usecase_tests/` | `unit_tests/`（.mjs, jsdom）與 `puppeteer_tests/`（E2E, `happy_path_*` 前綴 = CI 必跑） |
