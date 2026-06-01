# NOTE 2026-06-01 — Phase 13 / 批 E：工作區分頁跨裝置同步（使用者自有 Google Drive）

## 背景 / 目標
修正計畫 A–D（Phase 12）已合併。第 5 個議題「工作區跨裝置同步」原本只做一半：metadata（名稱/顏色/icon）已透過 `chrome.storage.sync` 跨裝置；**分頁內容快照**（`TabSnapshot[]`，含批 C 的 group 資訊）存 `chrome.storage.local`、per-device 不跨裝置（sync 每 key 僅 8KB）。

本批（批 E，整批完成、尚未 merge）用**使用者自己的 Google Drive（無開發者後端）**當分頁內容的同步持久層，讓 opt-in 的工作區其分頁能跨裝置同步／還原；未連結／停用時對現有本機行為**逐位元零影響**。

設計／交接文件：`docs/superpowers/specs/2026-06-01-workspace-drive-sync-design.md`（含已鎖定決策表、架構、E1–E5 進度、剩餘人工步驟、風險）。OAuth 設定步驟：`docs/google-drive-sync-setup.md`。

## 已鎖定決策（使用者拍板）
- **v1 收緊野心**：完整自動 opt-in 逐工作區同步；不做 Changes API / 客戶端加密 / 跨瀏覽器 / 欄位級合併。
- **Auth**：`chrome.identity.getAuthToken`（Chrome-only、無後端、不存長期憑證）。
- **Drive 範圍**：`drive.appdata`（隱藏 appDataFolder、卸載自動刪、non-sensitive、免 CASA 安全評估）。
- **衝突**：rev 為準 LWW + 保留敗方 conflicted-copy（**絕不靜默丟分頁**）；Drive server `version` 作樂觀鎖偵測、payload `rev` 作跨裝置排序；**3-way：雙方都改才算衝突，乾淨快進不算**。
- **metadata 留在 `chrome.storage.sync`**；Drive 只承載重的分頁快照（superset mirror）。
- **觸發**：debounced push + 週期拉取（~10 分，每次 SW 啟動重建 alarm）+ onStartup + 手動 Sync now。
- **預設 opt-in**：每工作區預設 OFF；master「連結 Drive」開關 gate 整個引擎。
- **新裝置**：雲端已同步工作區列為「可還原」清單、逐一手動啟用（不自動 opt-in）。
- **從 Drive 還原**：只寫回本機快照、不開分頁；下次 `switchWorkspace` 才開（非破壞）。
- **刪除**：soft-delete tombstone，~60 天 GC。
- **加密**：v1 不做。

## E1–E5 做了什麼
- **E1（基礎）**：
  - `modules/sync/syncProvider.js`：SyncProvider 介面（版本化 KV：`isConnected/list/read/write/remove`）+ `NoopSyncProvider`（inert 預設）+ `createFakeSyncProvider`（記憶體模擬、version 遞增、deep-clone 隔離、`__failNext` 故障注入，純 JS 無 chrome/fetch/OAuth）。
  - `modules/workspace/workspaceManager.js`：加 `rev`/`updatedAt`/`syncEnabled` + `setWorkspaceSyncEnabled`；rev 只在內容變更（create=1、update、snapshot）bump，**`setActiveWorkspace` 不 bump**；舊資料向後相容。後續加 `isWorkspaceBound`、`applyRemoteWorkspace`（寫回不開分頁、不 bumpRev、rev/updatedAt 取自 remote）。
  - `modules/sync/driveAuth.js`：getAuthToken 生命週期、`authedFetch`（401 flush stale token + 重取一次）、`connect`/`disconnect`（clearAll + best-effort server revoke）；無真 client_id 時 inert。
  - `manifest.json`：加 `identity` 權限 + `oauth2`（**佔位 client_id** + `drive.appdata` scope）；`docs/google-drive-sync-setup.md`（Cloud Console 設定步驟）。
- **E2（Drive client + 純邏輯，TDD）**：
  - `modules/sync/syncLogic.js`：純函式核心 — `decideSync`（create/push/pull/conflict/in-sync，3-way）、`resolveConflict`（rev-LWW + deviceId 字典序 tiebreak，跨裝置對稱、敗方留 conflicted-copy）、`decidePull`、`reconcile`（union 三方對賬）、`coalesceQueue`（delete 為終態）、`tombstonesToGC`、`isSchemaTooNew`、`SCHEMA_VERSION`。
  - `modules/sync/googleDriveProvider.js`：Drive v3 appDataFolder 的 SyncProvider（list 分頁 / read alt=media + metadata version / write multipart-create + media-PATCH / remove 404 冪等，注入式 authedFetch、name→fileId 快取），mock fetch 測請求構造與解析。
- **E3（同步引擎 + 接 background）**：
  - `modules/sync/syncEngine.js`：DI 編排核心，所有外部效果（provider I/O、本地 workspace 狀態、佇列、now、deviceId）經 deps 注入；disk-first 佇列冪等；remote 權威來源採 `provider.list()` + 逐檔讀（index 僅 advisory）；衝突/排序全用 payload rev、非 Drive version。
  - `background.js`：用真實 deps 建 syncEngine（GoogleDriveProvider + workspaceManager + chrome.storage.local 佇列/baseRev/restorable/status）；觸發點 = onChanged（去抖 push）/ alarms（driveSyncPull 週期、driveSyncFlush 一次性）/ onStartup / onMessage（driveSyncNow|Connect|Disconnect|Restore|SetWorkspaceSync）；`suppressSyncEnqueue` flag 防 pull→push→pull 迴圈；離線設 offline 狀態並略過；無 token 時 isConnected()=false → 引擎全程 inert。
- **E4（Options Sync 區 + sidepanel 徽章）**：
  - `options.js`：加第 8 個 nav 區塊 `renderSync`（Backup & Sync，置於 features 後）— Google Drive 連線/中斷、同步狀態、Sync now、逐工作區 opt-in、可從 Drive 還原清單、隱私 fine-print + Privacy Policy 連結；骨架同步渲染 + async hydrate（不主動觸發互動式 OAuth）。
  - `modules/ui/settingsBridge.js`：加 `driveSyncStatus`（local 區）分支 → dispatch `driveSyncStatusChanged`。
  - `modules/ui/driveSyncBadge.js`：sidepanel 唯讀徽章；純函式 `resolveBadgeView`（needs-auth/無狀態→隱藏）；初始讀 storage 繪製、之後反應 bridge 事件；只用 textContent。
- **E5（隱私 / i18n / 收尾）**：
  - E5b 隱私揭露已完成：`PRIVACY_POLICY.md` 加「工作區 Google Drive 同步」小節 + Limited Use 逐字聲明 + `identity` 權限列；`web/privacy.html` 同步（14 語系 `web/locales/*.json`）。
  - i18n：~20 個新 key × 14 語系（settingsNavSync、syncConnect/Disconnect、status、Sync now/Restore、隱私揭露、可還原、衝突檢視…）。
  - E5d（本筆記）：`GEMINI.md` key_files 補 6 個 sync 模組 + 更新 options/settingsBridge/manifest 條目；收尾筆記；全量驗證。

## 架構摘要
1. **SyncProvider seam**：引擎只對 `{isConnected,list,read,write,remove}` 介面說話。關閉→Noop（local-only 行為不變）、opt-in→GoogleDriveProvider、測試→FakeSyncProvider。
2. **引擎在 background**：DI 編排、disk-first 冪等佇列、debounced push + alarms 拉取；**不改 workspaceManager 公開 API**。
3. **資料模型（appDataFolder）**：每 opt-in 工作區一檔 `ws_<id>.json = {schemaVersion, workspaceId, rev, baseRev, deviceId, updatedAt, metadata, tabSnapshot[…group]}`；per-device `{rev,baseRev,lastSyncedAt}` + `deviceId` 存 local。
4. **衝突**：3-way 才衝突，rev 為準 LWW + conflicted-copy（`ws_<id>.conflict-<loserDeviceId>.json`）。
5. **opt-in 分離**：`syncEnabled`（跨裝置意圖、sync metadata）與 per-device「已實體化」旗標分離；新裝置看到 enabled 但無快照者列「可還原」。

## 關鍵正確性不變量
- **loser-before-winner**：衝突時先寫敗方 conflicted-copy 再寫勝方，避免任一步驟被 SW 中斷而丟失敗方分頁。
- **ack-only-after-write**：佇列 op 先寫檔成功才從佇列移除（mark-in-progress + ack），撐過 SW 被殺、保證冪等。
- **echo-map suppression**：pull/applyRemote 期間設 `suppressSyncEnqueue`，使自身寫入觸發的 onChanged 不再 enqueue → 杜絕 pull→push→pull 迴圈。
- **rev > baseRev guard**：只有 `rev > baseRev` 才視為本地有變更；pull 成功推進 `baseRev := remote.rev`，避免乾淨快進被誤判成衝突（3-way 核心）。
- **never-block-switchWorkspace**：拉到的快照只更新儲存、永不自動替換目前視窗分頁；`windowWorkspaceMap` 永不上傳；切換工作區流程絕不被同步阻塞。

## 測試姿態
- **單元 / 整合**：syncLogic 純函式全量單測；syncEngine **整合測試對 FakeSyncProvider 端到端**跑（衝突/bootstrap/tombstone/queue）；googleDriveProvider 以 mock fetch 測請求構造；syncProvider / driveSyncBadge 純函式測。
- **E2E**：`happy_path_drive_sync_section`（options Sync 區渲染、opt-in toggle 寫入，注入假狀態避免 CI 需真 OAuth）；`happy_path_options_page` 修正 nav 數為 8。
- **sync 層至 OAuth 設定前完全 inert**（佔位 client_id → isConnected()=false → Noop），現有行為零影響。

## 剩餘人工步驟（merge 前）
1. **owner 提供 OAuth client_id**：依 `docs/google-drive-sync-setup.md` 在 Google Cloud Console 建 Chrome-Extension 型 OAuth client（綁 Web Store 擴充 ID）、設定同意畫面 + `drive.appdata` scope + 隱私頁 URL，把真實 client_id 取代 `manifest.json` 佔位字串、加 `key` 讓 dev/prod 共用同一擴充 ID。
2. **部署 `web/`**：把官網（含 `web/privacy.html` 的 Limited Use 逐字聲明）部署至 live 網域，OAuth 品牌驗證會檢查此聲明可見。
3. 之後 **live 驗證 + 整批 merge**（不逐子批 merge：避免把 identity 權限 + 佔位 OAuth 在功能未就緒前推給使用者觸發權限警告）。

## 驗證 / 狀態（E5d 收尾跑）
- 單元：**209 綠 / 14 套件**（含 syncEngine / syncLogic / googleDriveProvider / driveSyncBadge / syncProvider）。
- `npm run test:ci`：**19 套件 48 測試全綠**（含新 `happy_path_drive_sync_section` 與修正後 `happy_path_options_page`）；唯一 RETRY 為 `happy_path_workspace_group_restore`（RETRY 1 後通過），即批 C 既有的新視窗 pendingUrl race flaky，與本批無關。
- `make`（dev）+ `make release`（prod）皆 OK；dev zip 含 `modules/sync/*` 五檔 + manifest（identity/oauth2/drive.appdata）；prod background 25KB bundle 內含全部 sync 程式碼（`appDataFolder`/`drive/v3/files`/`ws_`/`conflict-`/`getAuthToken`/`driveSyncStatus` 字串存在），prod manifest 亦含 oauth2/identity。standalone esbuild bundle background.js 乾淨（無錯誤/警告）。
- 分支 `feat/workspace-drive-sync`；尚未 merge（待上述人工步驟）。
