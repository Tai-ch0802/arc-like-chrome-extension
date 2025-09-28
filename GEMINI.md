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
  js_libraries:
    - Sortable.js
  build_tools:
    - make

# 關鍵檔案說明：各主要檔案的職責
key_files:
  - file_path: sidepanel.js
    description: "重構後的主檔案，作為應用程式的總協調者。負責初始化各模組，並串連事件監聽與功能呼叫。"
  - file_path: modules/apiManager.js
    description: "Chrome API 的封裝層。統一管理所有對 `chrome.*` API 的呼叫，方便維護與測試。"
  - file_path: modules/stateManager.js
    description: "UI 狀態管理員。集中管理如『書籤資料夾是否展開』等非同步的 UI 狀態。"
  - file_path: manifest.json
    description: "擴充功能的設定檔。定義名稱、版本、權限、圖示和快捷鍵等。"
  - file_path: sidepanel.html
    description: "側邊欄的 HTML 骨架，定義了 UI 的基本結構。"
  - file_path: sidepanel.css
    description: "側邊欄的樣式表，定義了整體的暗黑風格與佈局。"
  - file_path: background.js
    description: "背景腳本，負責監聽擴充功能安裝事件並設定側邊欄行為。"

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