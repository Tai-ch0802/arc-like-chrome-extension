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
    description: "[UI] 主題套用。Phase 12(批D) 精簡為 ~52 行：export applyTheme + initThemeSwitcher（載入時套用 theme/customTheme/背景；齒輪鈕改 chrome.runtime.openOptionsPage 開設定頁）。原 818 行的設定 dialog 已移除，內容遷至 options.js。"
  - file_path: options.html
    description: "[UI] 獨立設定頁（options_ui + open_in_tab）。Phase 12(批D) 新增；左側導覽 + 內容區，載入 sidepanel.css(共用元件樣式) + options.css(頁面版面) + options.js。"
  - file_path: options.js
    description: "[UI] 設定頁控制器。Phase 12(批D) 新增；左 nav 區塊，重用 customThemeManager/backgroundImageManager/rssManager/aiManager。控制項只 setStorage（不 dispatch CustomEvent，跨 context 靠 settingsBridge）。Phase 13(批E) 加入「備份與同步」(Backup & Sync) 區塊 renderSync（共 8 區塊：外觀/語言/功能/同步/AI/RSS/快捷鍵/關於）：Google Drive 連線/中斷(driveAuth.connect/disconnect)、同步狀態、立即同步、每個 workspace 的同步 opt-in、可從 Drive 還原的清單、隱私說明 + Privacy Policy 連結。先同步渲染骨架再 async hydrate（isConnected 不主動觸發互動式 OAuth）。"
  - file_path: modules/ui/settingsBridge.js
    description: "[UI] 設定傳播橋。Phase 12(批D) 新增；純函式 resolveSettingChangeActions 把 storage.onChanged 變更映射成 action（套主題/背景/reload/dispatch 既有可視性事件/refreshState 刷新 state 快取），sidepanel 端 initSettingsBridge 套用，使 options page 的變更即時反映且不需 reload。Phase 13(批E) 加入 driveSyncStatus 分支：local 區的 driveSyncStatus 變更映射成 dispatch driveSyncStatusChanged 事件，供 driveSyncBadge 即時更新徽章。"
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
    description: "[UI] Icon 系統(M3)。以 Material Symbols Outlined(viewBox 0 -960 960 960, fill=currentColor)集中管理；ICONS map(~40 icon)+ renderIcon/renderIconEl/hasIcon helper;既有 *_ICON_SVG 常數沿用同名匯出(改以 Material Symbols 重繪)。全 UI emoji 圖示改用此系統(inline SVG via innerHTML)。"
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
  - file_path: spotlight.html
    description: "[UI] Spotlight 搜尋彈窗頁面。以置中彈窗形式呈現，由 Cmd+Shift+K 快捷鍵（commandOpenSearch）開啟；連結 sidepanel.css（共用元件樣式）+ spotlight.js（ESM 入口）。無獨立 CSS 檔案。"
  - file_path: spotlight.js
    description: "[UI] Spotlight 頁面的 ESM 入口。初始化 spotlightController，串連搜尋 UI 與資料層；prod build 由 esbuild bundle + minify。"
  - file_path: modules/spotlight/spotlightController.js
    description: "[功能] Spotlight 搜尋控制器。管理置中搜尋彈窗的生命週期（開啟/關閉）、輸入處理、結果渲染，以及透過 panelBridge 與 sidepanel context 溝通。"
  - file_path: modules/commandPalette/searchContext.js
    description: "[功能] Spotlight 來源視窗上下文。儲存 Spotlight 啟動時的「來源 normal 視窗 id」（setOriginWindowId / getOriginWindowId）；因 Spotlight 為獨立 popup 視窗，item handler 須作用於使用者的瀏覽器視窗而非 popup，故由此提供作用目標視窗。"
  - file_path: modules/commandPalette/panelBridge.js
    description: "[通訊] Spotlight → sidepanel 橋接器（非 runtime messaging）。requestPanelAction 將 UI 類動作以 chrome.storage.session 旗標 pendingPanelAction 寫入並 sidePanel.open(來源視窗)，交由 sidepanel.js 的 consumePendingPanelAction 在正確 context 執行；openUrlInOrigin / resolveTargetWindowId 負責在來源 normal 視窗開分頁。"
  - file_path: modules/commandPalette/dataProvider.js
    description: "[功能] Command Palette / Spotlight 資料源。Phase 5 新增；聚合多個 source 的搜尋結果與分組顯示邏輯；index.js 已移除，資料/動作層（dataProvider/actions/nlSearch）現直接供獨立 Spotlight 彈窗（Cmd+Shift+K）使用。"
  - file_path: modules/commandPalette/actions.js
    description: "[功能] Command Palette 動作集合。Phase 5 新增；包含 new tab / smart group / AI cleanup / workspace 管理等可執行動作。"
  - file_path: modules/commandPalette/nlSearch.js
    description: "[AI] 自然語言搜尋。Phase 8b 新增；使用 Chrome Prompt API 作 reranker（非 filter），透過 preFilterByQuery 用 indexOf scoring 降低候選後再送 LLM。"
  - file_path: modules/workspace/workspaceManager.js
    description: "[功能] Workspace 業務邏輯。Phase 6 新增、Phase 9 重構儲存架構；分離 metadata (chrome.storage.sync, 8KB/key 限制) 與 tabSnapshot (chrome.storage.local)，含 legacy windowNames 一次性遷移與 onChanged 跨裝置同步。Phase 12(批C) 快照捕捉 tab group(groupKey/title/color)、切換時 best-effort 重建 group（純函式 buildSnapshotFromTabs / clusterCreatedTabsByGroup）。Drive sync (批E) 新增 isWorkspaceBound(查 windowWorkspaceMap 是否綁定) 與 applyRemoteWorkspace(把 Drive 拉回的 workspace 寫入本地，不開分頁、不 bumpRev、rev/updatedAt 直接取自 remote)。M3 重構:icon 改存 Material Symbols icon-id(PRESET_ICONS),resolveWorkspaceIcon 相容舊版 emoji(icon-id→SVG/舊 emoji→跳脫文字),isValidWorkspaceIcon 守衛接受 icon-id 或 <=4 emoji。"
  - file_path: modules/workspace/workspaceUI.js
    description: "[UI] Workspace 切換器與管理介面。M3 重構後:工作區列為單一 #workspace-switch-btn(名稱置中、無 emoji)→開管理 dialog;切換在 dialog 內(每列 .workspace-manage__switch 點擊即切換 performSwitch + 確認,含 unbound tabs auto-save 防資料遺失);rename/delete/cloud 用 Material Symbols。"
  - file_path: modules/sync/syncProvider.js
    description: "[同步] SyncProvider 介面定義（版本化 KV：isConnected/list/read/write/remove，read/write 帶 server version 樂觀鎖）。Phase 13(批E) 新增；提供 NoopSyncProvider（同步關閉時的 inert 預設，全部安全 no-op，保留 local-only 行為）與 createFakeSyncProvider（純 Map 記憶體模擬 + __failNext 故障注入，供單元/整合測試在 Node 跑、無 chrome/fetch/OAuth 依賴）。"
  - file_path: modules/sync/driveAuth.js
    description: "[同步] Google Drive OAuth 封裝。Phase 13(批E) 新增；用 chrome.identity.getAuthToken 管理 token 生命週期（MV3 不持久化 refresh token），提供 getToken/isConnected/connect(互動式，需 user gesture)/disconnect(flush + best-effort server revoke) 與 authedFetch(注入 Bearer、401 時 flush stale token 重取一次)。無真實 oauth2 client_id 時 getAuthToken reject → isConnected()=false → 整個同步層維持 inert。"
  - file_path: modules/sync/syncLogic.js
    description: "[同步] 純函式同步決策核心。Phase 13(批E) 新增；無 chrome/fetch/Date/Math.random/模組狀態，時間一律由 now 參數傳入，可在 Node 全量單元測試。含 decideSync(3-way：須兩端皆超過 baseRev 才算 conflict，避免乾淨 fast-forward 被誤判)、resolveConflict(rev-LWW + deviceId 字典序 tiebreak，loser 永不丟棄→保留為 conflicted copy ws_<id>.conflict-<loserDeviceId>.json)、decidePull、reconcile(union 三方對賬)、coalesceQueue(每 workspace 收斂單一 op，delete 為終態)、tombstonesToGC(grace window 過期墓碑)、isSchemaTooNew(遠端 schema 較新時不回寫降級)。"
  - file_path: modules/sync/googleDriveProvider.js
    description: "[同步] Drive v3 appDataFolder 的 SyncProvider 實作。Phase 13(批E) 新增；用注入式 authedFetch/isConnected（預設取自 driveAuth，測試可換 mock fetch），對 app-private、使用者不可見、解除安裝即自動清除的 appDataFolder 做 list/read(alt=media + version metadata)/write(multipart 建檔 / media PATCH 更新)/remove(404 視為冪等已刪)；name→fileId 快取；只負責建請求/解析/非 ok 拋錯，backoff/quota 分類交給引擎，絕不記錄 token 或完整檔案 body。"
  - file_path: modules/sync/syncEngine.js
    description: "[同步] 同步引擎（編排核心）。Phase 13(批E) 新增；以 DI 驅動 syncLogic 純函式對 SyncProvider 做 push/pull/衝突物化/tombstone GC。所有外部效果（provider I/O、本地 workspace 狀態、佇列、now、deviceId）一律經 deps 注入，引擎本身不碰 chrome/fetch/Date/crypto → 整合測試可直接對 FakeSyncProvider 端到端跑。disk-first 佇列冪等；remote 權威來源採 provider.list() + 逐檔讀（index 僅 advisory 優化）；所有衝突/排序決策用 payload 的 app-controlled rev、非 Drive server version。"
  - file_path: modules/ui/driveSyncBadge.js
    description: "[UI] sidepanel 同步狀態徽章。Phase 13(批E) 新增；非侵入式指示器置於 workspace 切換器旁，唯讀（連線/opt-in 控制在 options Sync 區塊）。純函式 resolveBadgeView 把 SyncStatus 映射成 view-model（needs-auth/無狀態→隱藏，不在 sidepanel 嘮叨）；初始一次性讀 chrome.storage.local.driveSyncStatus 繪製，之後反應 settingsBridge 派發的 driveSyncStatusChanged DOM 事件；只用 textContent、不 innerHTML。"
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
  - file_path: background.js
    description: "[Service Worker] MV3 背景腳本。處理快捷鍵指令、sidePanel 行為、AI 群組自動命名、RSS 鬧鐘。Drive sync (批E) 新增：用真實 deps 建立 syncEngine（GoogleDriveProvider + workspaceManager + chrome.storage.local 佇列/baseRev/restorable/status），觸發點 = onChanged(去抖 push)/alarms(driveSyncPull 週期、driveSyncFlush 一次性)/onStartup/onMessage(driveSyncNow|Connect|Disconnect|Restore|SetWorkspaceSync)；engineWriteEcho Map（workspaceId→引擎剛寫入的 rev 或字串 'deleted'）防 pull→push→pull 迴圈，並讓使用者刪除已同步工作區時觸發 enqueueDelete 寫入 tombstone（engine-initiated 刪除帶 'deleted' echo 則略過，不重複 tombstone）；離線(navigator.onLine===false)設 offline 狀態並略過；無 OAuth token 時 isConnected()=false → runSyncOnce/flush 在寫任何狀態前先 early-return（不寫 driveSyncStatus，避免從未連線的安裝產生狀態抖動），引擎全程 inert。"
  - file_path: manifest.json
    description: "擴充功能的設定檔。定義名稱、版本、權限、圖示和快捷鍵等。Phase 13(批E) 為 Drive sync 加入 identity 權限 + oauth2 區塊（client_id 目前為 placeholder，scopes 僅 drive.appdata 私有資料夾）；未填真實 client_id 前同步層維持 inert。"

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