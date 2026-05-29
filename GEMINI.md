# Gemini CLI 設定檔

# 專案類型：這是一個 Chrome 擴充功能
project_type: chrome_extension

# 技術棧：專案使用的主要技術
tech_stack:
  framework: Chrome Manifest V3
  frontend:
    - Vanilla JavaScript (ES6+)
    - HTML5
    - CSS3
  chrome_apis:
    - chrome.sidePanel
    - chrome.tabs
    - chrome.tabGroups
    - chrome.bookmarks
    - chrome.i18n
    - chrome.storage
    - chrome.readingList
    - chrome.alarms
    - chrome.scripting
  js_libraries:
    - Sortable.js
  build_tools:
    - make

# 關鍵檔案說明：各主要檔案的職責
key_files:
  - file_path: sidepanel.js
    description: "[總指揮] 應用程式進入點與總協調者。負責初始化各模組、串連瀏覽器事件監聽（特別是同步書籤與分頁關聯狀態的生命週期事件）。"
  - file_path: modules/uiManager.js
    description: "[UI Facade] UI 模組的入口點。作為 Facade 模式，重新匯出 `modules/ui/` 下的所有子模組功能，保持對外接口一致。"
  - file_path: modules/ui/elements.js
    description: "[UI] DOM 元素集中管理。負責匯出所有主要 UI 容器與控制元件的 DOM 引用。"
  - file_path: modules/ui/settingManager.js
    description: "[UI] 設定與主題管理。負責主題切換邏輯、設定面板的渲染與事件綁定。"
  - file_path: modules/ui/customThemeManager.js
    description: "[UI] 自訂主題管理。負責顏色選擇器面板 UI、使用者自訂配色儲存與載入、以及 JSON 匯出匯入功能。"
  - file_path: modules/ui/backgroundImageManager.js
    description: "[UI] 背景圖片管理。負責背景圖片面板 UI、圖片儲存與載入，以及套用 CSS 背景變數。"
  - file_path: modules/utils/imageUtils.js
    description: "[工具] 圖片處理工具。提供圖片壓縮、WebP 轉換、縮放與 URL 抓取功能。"
  - file_path: modules/utils/textUtils.js
    description: "[工具] 文字工具函式庫。提供安全處理 HTML 的工具函式，如 `escapeHtml` 以防止 XSS 攻擊。"
  - file_path: modules/utils/colorUtils.js
    description: "[工具] 顏色工具函式庫。提供 HSL/HEX 轉換、WCAG 對比度計算以及衍生色演算法。"
  - file_path: modules/ui/searchUI.js
    description: "[UI] 搜尋介面。負責搜尋結果計數顯示與無結果提示的 UI 更新。"
  - file_path: modules/ui/tabRenderer.js
    description: "[UI] 分頁渲染。負責分頁與分頁群組的 DOM 結構生成與事件綁定。"
  - file_path: modules/ui/bookmarkRenderer.js
    description: "[UI] 書籤渲染。負責書籤列表、資料夾結構以及連結分頁面板的渲染邏輯。"
  - file_path: modules/modalManager.js
    description: "[互動] 提供客製化的 `showPrompt` 和 `showConfirm` 函式，用以取代原生對話框，提升使用者體驗。"
  - file_path: modules/apiManager.js
    description: "[通訊] Chrome API 的封裝層。統一管理所有對 `chrome.*` API 的呼叫（包含書籤搜尋），方便維護與測試。"
  - file_path: modules/stateManager.js
    description: "[狀態] UI 狀態管理員。集中管理如『書籤資料夾是否展開』等非同步 UI 狀態，以及『書籤-分頁』的持久化關聯狀態。"
  - file_path: modules/dragDropManager.js
    description: "[功能] 拖曳排序模組。封裝 SortableJS 的所有邏輯，處理分頁與書籤的拖曳事件，並在拖曳分頁成為書籤時建立關聯。"
  - file_path: modules/searchManager.js
    description: "[功能] 搜尋過濾模組。負責處理搜尋框的輸入與列表的即時過濾邏輯。"
  - file_path: modules/readingListManager.js
    description: "[功能] 閱讀清單業務邏輯。管理閱讀清單 CRUD 操作、自動分組開啟的分頁、刪除時標記 hash 防止 RSS 重複加入、清除所有已讀功能。"
  - file_path: modules/rssManager.js
    description: "[功能] RSS 訂閱管理。處理 RSS feed 訂閱儲存、chrome.alarms 排程抓取、hash 去重、自動加入閱讀清單、手動立即抓取功能。"
  - file_path: modules/ui/readingListRenderer.js
    description: "[UI] 閱讀清單渲染。負責閱讀清單項目的 DOM 生成、事件處理（點擊/刪除/切換已讀）、展開收合、鍵盤導航、新項目標籤、排序功能 (日期/標題)。"
  - file_path: modules/icons.js
    description: "[UI] SVG 圖示集中管理。匯出所有 UI 使用的 SVG 圖示常數，避免重複定義。"
  - file_path: modules/aiManager.js
    description: "[AI] 本機 AI 模型管理。封裝 LanguageModel (Prompt API) 與 Summarizer API；提供 tab grouping、頁面摘要、AI 群組自動命名 (generateGroupName)、AI tab cleanup 建議 (generateCleanupSuggestions)、reading-list 摘要 (summarizeText)、自然語言搜尋的 reranker (runPrompt，使用獨立 nlLanguageModelSession)。"
  - file_path: modules/ui/aiGrouperUI.js
    description: "[UI] 智慧整理介面。負責處理未分類分頁的讀取、呼叫 AI、執行群組化，以及 Toast 復原機制。"
  - file_path: modules/ui/aiCleanupUI.js
    description: "[UI] AI Tab Cleanup 介面。Phase 4b 新增；在 Smart Group 旁顯示 🧹 按鈕，inline section 展示 AI 建議的可關閉分頁清單（預設勾選 + 全選控制）。Phase 12(批B) 每列加 tab group badge（彩色圓點 + 群組名，未分組不顯示），用 resolveTabGroupBadge 判定。"
  - file_path: modules/ui/hoverSummarizeManager.js
    description: "[功能] Hover Summarize 核心邏輯。管理 2 秒 debounce、AbortController 取消、chrome.scripting 文字擷取、Summarizer API 串流摘要、記憶體快取。"
  - file_path: modules/ui/hoverTooltip.js
    description: "[UI] Hover Summarize 的 Tooltip UI 元件。提供 show/hide/updateStreamChunk API，含 shimmer 載入動畫與 glassmorphism 樣式。"
  - file_path: modules/commandPalette/index.js
    description: "[功能] Command Palette (⌘K / Ctrl+K) 入口。Phase 5 新增；統一搜尋 tabs / bookmarks / reading list / actions / workspaces。"
  - file_path: modules/commandPalette/dataProvider.js
    description: "[功能] Command Palette 資料源。Phase 5 新增；聚合多個 source 的搜尋結果與分組顯示邏輯。"
  - file_path: modules/commandPalette/actions.js
    description: "[功能] Command Palette 動作集合。Phase 5 新增；包含 new tab / smart group / AI cleanup / workspace 管理等可執行動作。"
  - file_path: modules/commandPalette/nlSearch.js
    description: "[AI] 自然語言搜尋。Phase 8b 新增；使用 Chrome Prompt API 作 reranker（非 filter），透過 preFilterByQuery 用 indexOf scoring 降低候選後再送 LLM。"
  - file_path: modules/workspace/workspaceManager.js
    description: "[功能] Workspace 業務邏輯。Phase 6 新增、Phase 9 重構儲存架構；分離 metadata (chrome.storage.sync, 8KB/key 限制) 與 tabSnapshot (chrome.storage.local)，含 legacy windowNames 一次性遷移與 onChanged 跨裝置同步。Phase 12(批C) 快照捕捉 tab group(groupKey/title/color)、切換時 best-effort 重建 group（純函式 buildSnapshotFromTabs / clusterCreatedTabsByGroup）。#5 分頁內容跨裝置同步延後，方向是用 Google Drive 當持久層。"
  - file_path: modules/workspace/workspaceUI.js
    description: "[UI] Workspace 切換器與管理介面。Phase 6 新增；下拉切換 + 管理 modal + 切換確認 (含 unbound tabs 自動 auto-save 防資料遺失)。"
  - file_path: modules/bookmark/tagManager.js
    description: "[功能] 書籤多標籤管理。Phase 7 新增；用 chrome.storage.local 自建 tag index 突破 Chrome 內建單層資料夾限制。"
  - file_path: modules/bookmark/dedupe.js
    description: "[功能] 重複書籤偵測與批次清理。Phase 7 新增；以 normalized URL 分組，UI 允許每組保留任一份。"
  - file_path: modules/bookmark/deadLinkChecker.js
    description: "[功能] 死連結掃描。Phase 7 新增；用 HEAD 請求批次掃描 http(s) 書籤，含 navigator.onLine 預檢、預設未勾選、suspicious-ratio 警告三重防誤刪。"
  - file_path: modules/bookmark/bookmarkUtils.js
    description: "[工具] 書籤共用工具。Phase 7 新增；URL normalize、host 抽取等純函式，方便單元測試。Phase 12 加入 filterBookmarksUnderFolder（依 parentId DFS 取資料夾子樹書籤，供局部掃描）。"
  - file_path: modules/bookmark/bookmarkToolsUI.js
    description: "[UI] Bookmark Tools modal。Phase 7 新增；整合 Tags / Duplicates / Dead Links 三個 tab。Phase 12(批A) 加入範圍列（scope bar）+ pickFolder，可限定資料夾子樹做重複/死連結掃描。批B 死連結結果每列顯示完整資料夾路徑（pathById 查 .bm-tools__dup-path）。"
  - file_path: modules/bookmark/tagPicker.js
    description: "[UI/工具] 共用標籤勾選元件。Phase 12 新增；createTagPicker 回傳 {element, getSelectedTagIds} 只負責呈現與回傳選取（寫入由呼叫端決定），純函式 diffTagSelection 算 add/remove 差集。右鍵 popover 與編輯對話框共用。"
  - file_path: modules/ui/bookmarkContextMenu.js
    description: "[UI] 書籤/資料夾右鍵選單。Phase 12 新增；與分頁用 contextMenuManager 分離。書籤列→複製 URL/管理標籤(就地 tag popover，勾選即時寫入)；資料夾列→整理此資料夾(找重複/查死連結，帶 scopeFolderId)。document click 採 outside-only 關閉，nested modal 不誤關。"
  - file_path: modules/readingList/summaryStore.js
    description: "[功能] Reading List 摘要本機儲存。Phase 8a 新增；存於 chrome.storage.local，含 pruneOrphans 守衛防止空陣列誤刪全部。"
  - file_path: modules/readingList/summaryRecorder.js
    description: "[功能] Reading List 摘要錄製器。Phase 8a 新增；當使用者把開啟中分頁加入 Reading List 時，自動透過 Summarizer API 摘要並存檔，離線時可預覽。"
  - file_path: modules/utils/searchUtils.js
    description: "[工具] 搜尋純函式工具。Phase 1.2 提取自 searchManager；避免測試時連帶 import elements.js 觸發 DOM 存取，含 matchesAnyKeyword、extractDomain。"
  - file_path: modules/utils/pageContentExtractor.js
    description: "[工具] 頁面內容擷取。Phase 8 新增；給 reading list 摘要與 NL search 使用，透過 chrome.scripting 抓取頁面文字。"
  - file_path: modules/keyboardManager.js
    description: "[功能] 鍵盤快捷鍵管理。Phase 9 新增；管理 sidepanel 內 keyboard shortcuts（受限於 chrome.commands API 4-command 上限，sidepanel-only 快捷鍵走自管路線）。"
  - file_path: modules/ui/tab/tabListeners.js
    description: "[UI] 分頁事件監聽。Phase 3 重構自 tabRenderer.js；負責 click / drag / contextmenu 等事件綁定。"
  - file_path: modules/ui/tab/splitViewRenderer.js
    description: "[UI] Split View 分頁渲染。Phase 3 重構自 tabRenderer.js；專門處理 split-view 分頁顯示。"
  - file_path: jest.config.js
    description: "[Test] Jest 設定（Phase 1.2 補單元測試骨架）。設定 jsdom 環境、transform 使用 esbuild-jest。"
  - file_path: jest.esbuild-transform.cjs
    description: "[Test] Jest 自訂 transform。Phase 1.2 新增；用 esbuild 將 ESM .js 編譯為 CJS，避免引入 babel-jest 依賴。"
  - file_path: manifest.json
    description: "擴充功能的設定檔。定義名稱、版本、權限、圖示和快捷鍵等。"

# 主要語言：與 Gemini CLI 互動時偏好的自然語言
language: zh-TW

# 建置說明：如何建置此專案
build_instructions: |
  本專案使用 `make` 進行建置與打包。
  - 執行 `make` 或 `make package` 將會產生一個 `arc-sidebar-v<版本號>.zip` 檔案。
  - **需求**: 需要安裝 `jq` (一個命令列 JSON 處理工具) 才能自動讀取版本號。

# 預覽/執行說明：如何在開發環境中執行或預覽此專案
preview_instructions: |
  要在 Chrome 中測試此擴充功能：
  1. 前往 `chrome://extensions`。
  2. 開啟「開發人員模式」。
  3. 點擊「載入未封裝的項目」。
  4. 選擇此專案的根目錄。

# 部署說明：如何部署此專案
deploy_instructions: |
  1. 執行 `make package` 來產生一個 `.zip` 格式的打包檔案。
  2. 前往 Chrome 開發人員資訊主頁上傳該檔案並發布。

# 標籤：幫助 Gemini 更了解專案的關鍵字
tags:
  - chrome-extension
  - javascript
  - vanilla-js
  - manifest-v3
  - sidebar

# 歡迎訊息：當 Gemini CLI 在此專案啟動時顯示的訊息
welcome_message: |
  你好！這是一個 Arc 風格的 Chrome 側邊欄擴充功能，提供垂直分頁與書籤管理。
  你可以使用 `make` 指令來打包專案，或直接在 Chrome 中載入未封裝的專案目錄進行測試。
  需要幫忙嗎？

# Commit 指南：撰寫 Commit Message 的風格指南
commit_guidelines: |
  請遵循 Conventional Commits 規範。
  Commit message 的第一行 (subject) 必須使用英文。
  Commit message 的內文 (body) 應使用繁體中文，詳細說明改動的背景、原因和實現細節。

# Release Note 規範：撰寫 release note 時應遵循的風格
release_note_guidelines: |
  當需要撰寫 release note 時，請遵循 `.github/release.yml` 中定義的結構與風格。
  主要包含以下區塊：
  - **✨ 新功能 (New Features)**
  - **🚀 改善與錯誤修復 (Improvements & Bug Fixes)**
  語言應以繁體中文為主。
  產出的 `RELEASE_NOTE.md` 檔案僅為臨時預覽用途，應被加入 `.gitignore` 中，不進入版控。

# PR Review 指南
pr_review_guidelines: |
  請遵循 `.agent/rules/RULE_006_PR_REVIEW_GUIDELINES.md` 規範。
  - 使用 `gh` CLI 進行 Review。
  - 語言使用繁體中文 (zh-TW)。
  - 必須在結尾附上 `created by antigravity agent` 簽名。

# 開發準則
- 在做任何改動時，需要留意是否可能影響其他的檔案。並且時刻留意此次的改動項目，必要時在 GEMINI.md 上調整專案 key_files 的描述及調整。

# Context Engineering
- 在一個開發 session 結束時，應將當次所有變動內容進行摘要，並儲存至 `.agent/notes/NOTE_YYYYMMDD.md` 檔案中，以作為未來開發的脈絡參考。