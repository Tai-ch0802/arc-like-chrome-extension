# Architecture — 系統架構

> 檔案級職責的單一事實來源是 repo 內 [`GEMINI.md`](https://github.com/Tai-ch0802/arc-like-chrome-extension/blob/main/GEMINI.md) 的 `key_files` 區塊（每個模組一句話職責＋演進歷史）。本頁提供人類友善的總覽。

## 執行 Context（Manifest V3）

一個 MV3 擴充功能同時存在多個 JavaScript 執行環境，彼此**不共享記憶體**，只能透過 `chrome.storage` 或 messaging 溝通：

| 進入點 | Context | 職責 |
|---|---|---|
| `background.js` | Service Worker | 快捷鍵指令、sidePanel 行為、RSS 排程（alarms）、workspace 生命週期快照、Google Drive 同步引擎。**隨時可能被 Chrome 終止**，不能依賴 in-memory 狀態。 |
| `sidepanel.js` | Side Panel 頁面 | 應用主入口：初始化 `modules/` 各模組、串連瀏覽器事件監聽。 |
| `options.js` | 設定頁（獨立分頁開啟） | 全部設定 UI（外觀/語言/功能/同步/AI/RSS/快捷鍵/關於）。 |
| `spotlight.js` | 獨立 popup 視窗 | Spotlight 搜尋（Cmd/Ctrl+Shift+K）。 |
| `offscreen.js` | Offscreen Document | 需要 DOM 能力的背景工作。 |

### 跨 context 溝通協定

- **settingsBridge**（`modules/ui/settingsBridge.js`）：options 頁只寫 `chrome.storage`，sidepanel 監聽 `storage.onChanged`，由純函式 `resolveSettingChangeActions` 映射成動作（套主題/重繪/reload），設定變更即時生效。
- **panelBridge**（`modules/commandPalette/panelBridge.js`）：Spotlight → sidepanel 的動作轉交。以 `chrome.storage.session` 旗標（帶目標 windowId + timestamp，TTL 15s）定址，防止錯誤視窗執行或重複執行。
- **runtime messaging**：Drive sync 指令（`driveSyncNow` / `Connect` / `Disconnect` 等）由 UI 發訊給 background 執行。

## 模組地圖

```
modules/
├── (根層)             apiManager｜stateManager｜modalManager｜dragDropManager
│                      searchManager｜keyboardManager｜aiManager｜rssManager
│                      readingListManager｜icons（M3 圖示系統）｜uiManager（UI Facade）
├── ui/                tabRenderer｜bookmarkRenderer｜settingManager｜settingsBridge
│   │                  customThemeManager｜backgroundImageManager｜aiGrouperUI｜aiCleanupUI
│   │                  hoverSummarizeManager｜hoverTooltip｜bookmarkContextMenu
│   │                  contextMenuManager｜driveSyncBadge｜otherWindowRenderer｜elements
│   └── tab/           tabListeners｜splitViewRenderer
├── commandPalette/    dataProvider｜actions｜nlSearch｜panelBridge｜searchContext
├── spotlight/         spotlightController
├── workspace/         workspaceManager｜workspaceLifecycle（SW 常駐）｜workspaceUI
├── bookmark/          tagManager｜dedupe｜deadLinkChecker｜tagPicker｜bookmarkUtils｜bookmarkToolsUI
├── readingList/       summaryStore｜summaryRecorder
├── sync/              syncProvider（介面）｜driveAuth｜googleDriveProvider
│                      syncLogic（純函式決策核心）｜syncEngine（DI 編排）
└── utils/             colorUtils｜imageUtils｜textUtils｜searchUtils
                       domUtils｜functionUtils｜iconUtils｜pageContentExtractor
```

## 架構不變式

改動程式碼前先確認沒有違反（完整版見 `.agent/rules/RULE_002_ARCHITECTURE.md`）：

1. **Chrome API 一律經 `apiManager` 封裝**——UI/業務模組不直接呼叫 `chrome.*`。
2. **DOM 引用集中在 `ui/elements.js`、DOM 生成集中在 `*Renderer.js`**——業務邏輯不碰 DOM。
3. **`uiManager` 是 UI Facade**，外部只 import facade。
4. **SVG 圖示集中於 `icons.js`**（Material Symbols），禁止硬編碼。
5. **可測試性優先**：純函式抽到 `utils/`，不 import `elements.js`；同步引擎採依賴注入。
6. **新增跨 context 協定 / 改 storage schema 屬 SDD T2**（先寫 spec、先審後做）。
7. **新增/改名檔案必須同步 `Makefile`**，否則 release zip 漏包（歷史事故）。

## Storage 慣例

- `chrome.storage.sync`：跨裝置的小型 metadata（**8KB/key 配額**）。Workspace 身分存 `wsMeta_<id>`。
- `chrome.storage.local`：大型/本機資料。Workspace 快照存 `wsSnap_<id>`（schema v2，per-id key 使快照路徑零 sync 寫入）。
- `chrome.storage.session`：跨 context 的暫態旗標（如 panelBridge）。
- 多 context 寫同一 key 時**必須 read→merge→write（delta 合併）**，嚴禁全表覆寫——曾發生 debounced reload 後全表寫入清空綁定的事故。

## Google Drive 同步（選用功能）

分層：`syncLogic`（純函式：3-way 差異判定、rev-LWW 衝突解決、tombstone GC）→ `syncEngine`（DI 編排）→ `googleDriveProvider`（Drive v3 appDataFolder）→ `driveAuth`（`chrome.identity.getAuthToken`）。設計要點：衝突輸家保留為 conflicted copy 不丟資料；未連線時整層 inert；詳見 `docs/google-drive-sync-setup.md`。
