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

- `chrome.storage.sync`：**只剩** Workspace 身分 `wsMeta_<id>`（8KB/key 配額）。偏好設定自 ISSUE-257 起**不再**使用 sync 區：它只在同一 Google 帳號的 Chrome 之間同步，Dia 等 Chromium 分支沒有這個後端；舊的 flat key 保留不刪（未升級裝置仍讀），新版一律忽略。
- `chrome.storage.local`：大型/本機資料。Workspace 快照存 `wsSnap_<id>`（schema v2，per-id key 使快照路徑零 sync 寫入）。RSS 訂閱清單 `rssSubscriptions`（自 sync 遷入，一次性 `rssMigratedFromSync` 旗標；不刪舊 sync key 以免 wipe 未升級裝置）、去重 hash `rssFetchedHashes`、刪除 tombstone `rssTombstones` 均存此。**偏好設定**每個 key 一筆 `pref_<name> = { v, t }`（`modules/prefs/prefsStore.js`；一次性 `prefsMigratedFromSync` 做種，defaults 永不落地）。閱讀清單同步側車 `readingListSyncMeta` / `readingListTombstones`。每裝置能力旗標 `tabGroupsUnsupported` / `sidePanelUnavailable`、auth 模式 `driveAuthMode` 與 web token `driveWebAuth` 亦在此且**永不同步**。
- `chrome.storage.session`：跨 context 的暫態旗標（如 panelBridge）。
- 多 context 寫同一 key 時**必須 read→merge→write（delta 合併）**，嚴禁全表覆寫——曾發生 debounced reload 後全表寫入清空綁定的事故；RSS `rssFetchedHashes` 曾因 side panel 陳舊快照全表覆寫導致去重失效，已改為序列化 union 寫入（`rssManager` `hashWriteChain`）。

## 非 Chrome 瀏覽器（Dia）相容

Dia（Chromium 分支）的 UA 字串與 Chrome 完全相同，但 `chrome.tabs.group()` 一律丟 `Error: No window`、沒有瀏覽器層 Google 帳號、`storage.sync` 只在本機。對策（ISSUE-257，實測見 `docs/specs/feature/ISSUE-257_dia-compat/SPIKE.md`）：

- **品牌偵測**只用 `navigator.userAgentData.brands`（`modules/utils/browserCapabilities.js`），brands 缺席保守視為 Chrome。
- **分頁群組 best-effort**：`apiManager` 的群組 wrapper 失敗回 `null`，Dia 的 `No window`（或非 Chrome 連續兩次非暫時性失敗）記每裝置旗標 `tabGroupsUnsupported`；旗標下隱藏 Smart Group / 每列 add-to-group / 右鍵「總是分群」/ Spotlight 分群動作，options 開關停用並說明。Chrome 的暫時性錯誤（拖曳中、stale id）永不設旗標。工作區在此裝置重新快照時依 URL 沿用舊快照的群組欄位（carry-forward），避免剝掉群組後推上 Drive。
- **側欄入口**：非 Chrome 品牌關閉 `openPanelOnActionClick`，由 `modules/sidePanelEntry.js` 在 `action.onClicked` 的 user gesture 內自行 `sidePanel.open`，以 `onOpened` 確認；開不了則記 `sidePanelUnavailable`（含原因）並開 options 說明。
- **能力旗標**只存 `storage.local`、品牌或主版本變更時自動重置、永不同步。

## Google Drive 同步（選用功能）

分層：`syncLogic`（純函式：3-way 差異判定、rev-LWW 衝突解決、tombstone GC）→ `syncEngine`（DI 編排）→ `googleDriveProvider`（Drive v3 appDataFolder）→ `driveAuth`（auth facade）。設計要點：衝突輸家保留為 conflicted copy 不丟資料；未連線時整層 inert；詳見 `docs/google-drive-sync-setup.md`。

**兩種 auth 模式（ISSUE-257）**：連結當下依 `navigator.userAgentData.brands` 判斷品牌並持久化 `driveAuthMode`。Google Chrome 走 `chrome.identity.getAuthToken`（瀏覽器帳號層）；其他 Chromium 品牌（Dia、Edge…）沒有這層，改走 `modules/sync/webAuthFlow.js` 的 `launchWebAuthFlow` implicit grant（Web application client，redirect 為商店版 id 的 `chromiumapp.org`；token 只存 local、靜默續期以 `prompt=none` + `login_hint`，失敗交給引擎寫 `needs-auth`）。Chrome 絕不落入 web 模式。`userinfo.email` scope 只在 Web 授權 URL 要求、不進 manifest（改 manifest scope 會讓既有 Chrome 使用者授權快取失效）。

**偏好設定與閱讀清單**也各走一條與 RSS 同型的輕量路徑：`settings-sync.json`（`modules/prefs/prefsSync.js`，per-key LWW，「缺席 = 無主張」讓新裝置的預設值不會打敗真實設定）與 `reading-list-sync.json`（`modules/readingList/readingListSync.js` + `readingListSyncStore.js`；`chrome.readingList` 仍是本機資料源，SW 以 app 控制的 Lamport 側車與 tombstone 鏡像，echo 守衛避免引擎寫入被當成使用者編輯）。

RSS 狀態同步走**獨立的輕量路徑**（不套 `syncEngine` 的 rev/baseRev 模型）：訂閱清單 + 去重 hash + tombstone 存於單一 appdata 檔 `rss-sync.json`，以 set-union / id-merge 的純函式 `modules/rss/rssSyncLogic.js`（`mergeRssState`，commutative + idempotent）合併，收斂靠 no-op write guard（≤2 cycle）取代回音抑制。子系統與 workspace 檔互不干擾（`pullRemote` 以 `/^ws_.../` 過濾略過 `rss-*.json`）；接線在 `background.js` `rssSyncOnce`（single-flight），pull piggyback 於 `runSyncOnce`、push 由 `rssSyncFlush` debounce alarm 觸發。
