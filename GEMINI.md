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
  - file_path: modules/ui/themeManager.js
    description: "[UI] 主題管理。負責主題切換邏輯、設定面板的渲染與事件綁定。"
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
    description: "[AI] 本機 AI 模型管理。負責封裝與 Chrome `globalThis.LanguageModel` (Gemini Nano) 的對接、Prompt 生成及防呆。"
  - file_path: modules/ui/aiGrouperUI.js
    description: "[UI] 智慧整理介面。負責處理未分類分頁的讀取、呼叫 AI、執行群組化，以及 Toast 復原機制。"
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