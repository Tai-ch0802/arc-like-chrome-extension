# 批 E：工作區分頁跨裝置同步 — 使用者自有 Google Drive 持久層（設計 + 進度 + 交接）

- **狀態**：E1（基礎）+ E2（Drive client + 純邏輯）**已完成並通過測試**；E3/E4/E5 待續。
- **分支**：`feat/workspace-drive-sync`（不逐子批 merge，整個 feature 完整且 OAuth 設定好才整批 merge——見下方理由）。
- 此設計由多代理研究工作流產出（6 維度 → 綜合 3 方案 → 完整性批判），已對 2025–2026 Chrome MV3 / Drive API 文件查證。

---

## Context / 目標

修正計畫 A–D 已合併。第 5 個議題「工作區跨裝置同步」目前只做一半：metadata（名稱/顏色/icon）已透過 `chrome.storage.sync` 跨裝置；**分頁內容快照**（`TabSnapshot[]`，含批 C 的 group 資訊）存 `chrome.storage.local`、per-device 不跨裝置（因 sync 每 key 僅 8KB）。

本批用**使用者自己的 Google Drive（無開發者後端）**當分頁內容的同步持久層，讓選定的工作區其分頁能跨裝置同步／還原；未連結／停用時完全不影響現有本機行為。

## 已鎖定決策（使用者拍板）

| 決策 | 選擇 |
|------|------|
| v1 野心 | 完整自動 opt-in 逐工作區同步（v1 收緊：不做 Changes API / 客戶端加密 / 跨瀏覽器 / 欄位級合併） |
| Auth | `chrome.identity.getAuthToken`（Chrome-only、無後端） |
| Drive 範圍 | `drive.appdata`（隱藏 appDataFolder、卸載自動刪、non-sensitive、免 CASA） |
| 衝突 | rev 為準 LWW + 保留敗方 conflicted-copy（絕不靜默丟分頁）；server `version` 偵測、payload `rev` 排序；**3-way：雙方都改才衝突，乾淨快進不算衝突** |
| metadata | 維持 `chrome.storage.sync`；Drive 只承載重的分頁快照（superset mirror） |
| 觸發 | debounced push + 定期拉取（~10 分，每次 SW 啟動重建 alarm）+ onStartup + 手動 Sync now |
| 預設 opt-in | 每工作區預設 OFF；master「連結 Drive」開關 gate 引擎 |
| 新裝置 | 雲端已同步工作區列為「可還原」清單、逐一手動啟用（不自動 opt-in） |
| 從 Drive 還原 | 只寫回本機快照、不開分頁；下次 `switchWorkspace` 才開（非破壞） |
| 刪除 | soft-delete tombstone，~60 天 GC |
| 斷線 | inline 詢問刪雲端 vs 保留；斷線 = clearAllCachedAuthTokens + best-effort revoke |
| 加密 | v1 不做 |

## 架構

疊加為嚴格附加 overlay，sync 關閉時本機行為與今日逐位元相同。

1. **`SyncProvider` 介面**（`modules/sync/syncProvider.js`）：版本化鍵值存放抽象 `{isConnected, list, read, write, remove}`。預設 `NoopSyncProvider`（全 inert）；opt-in 換 `GoogleDriveProvider`；`FakeSyncProvider`（記憶體 Drive 模擬）供測試。
2. **引擎在 `background.js`**（E3，未做）：觀察 `chrome.storage.onChanged`、逐工作區 diff rev、push op 進 disk-first `chrome.storage.local.syncQueue`（mark-in-progress + ack，撐過 SW 被殺、冪等）；`chrome.alarms` 定期 flush + 拉取（每次 SW 啟動重建）。**不改 workspaceManager 公開 API**。
3. **資料模型**（appDataFolder）：每 opt-in 工作區一檔 `ws_<id>.json = {schemaVersion, workspaceId, rev, baseRev, deviceId, updatedAt, metadata, tabSnapshot[…group]}`；一個 advisory `appdata-index.json`（reconcile 以 `files.list` 為權威）；per-device `{rev,baseRev,lastSyncedAt}` + `deviceId` 存 local。
4. **衝突**：push 前讀 server `version`；3-way（localChanged && remoteChanged）才衝突；rev 高者勝（同 rev deviceId 字典序），敗方寫 `ws_<id>.conflict-<deviceId>.json`。
5. **opt-in/新裝置**：`syncEnabled`（跨裝置意圖、sync metadata）+ per-device「已實體化」local 旗標分離；新裝置看到 enabled 但本機無快照者 → 列「可還原」。
6. **還原/live window 安全**：拉到的快照只更新儲存、永不自動替換目前視窗分頁；`windowWorkspaceMap` 永不上傳；`switchWorkspace` 絕不被阻塞。
7. **bootstrap**：沿用 Phase-9 模式，seed-if-empty 否則三方 reconcile；不在無 tombstone 時自動刪本機。
8. **schema 偏移**：pull 到較新 schemaVersion → 唯讀不回寫、提示更新。
9. **失敗模式**：401→removeCachedAuthToken→重取一次；403 rateLimit/429→指數退避；403 storageQuotaExceeded→「Drive 已滿」暫停（與 rate-limit 區分）；token/含 URL 回應絕不寫 log。
10. **Options 整合**（E4，未做）：`options.js` 加 `sync` section（骨架同步畫、async IIFE 水合，仿 `renderAi`）；連線前 `modalManager.showConfirm` 隱私同意；狀態寫 `chrome.storage.local.driveSyncStatus`，`settingsBridge` 加 local 分支 → sidepanel 同步徽章。

---

## 進度（本 PR 已完成）

### ✅ E1 — 基礎
- `modules/sync/syncProvider.js`：SyncProvider 介面 + NoopSyncProvider + FakeSyncProvider（記憶體、version 遞增、deep-clone 隔離、`__failNext` 故障注入）。
- `modules/workspace/workspaceManager.js`：加 `rev`/`updatedAt`/`syncEnabled` + `setWorkspaceSyncEnabled`；rev 只在內容變更（create=1、update、snapshot）bump，**setActiveWorkspace 不 bump**；舊資料向後相容預設。
- `modules/sync/driveAuth.js`：getAuthToken 生命週期、`authedFetch`（401 flush+重取一次）、`connect`/`disconnect`（clearAll + best-effort revoke）；無 client_id 時 inert。
- `manifest.json`：加 `identity` 權限 + `oauth2`（**佔位 client_id** + `drive.appdata` scope）；`docs/google-drive-sync-setup.md`（Cloud Console 設定步驟）。

### ✅ E2 — Drive client + 純邏輯
- `modules/sync/syncLogic.js`（**純函式、TDD**）：`decideSync`（4-way：create/push/pull/conflict/in-sync）、`resolveConflict`（rev LWW + deviceId tiebreak，**跨裝置對稱**、敗方留 conflicted-copy）、`decidePull`、`reconcile`（三方）、`coalesceQueue`（delete terminal）、`tombstonesToGC`、`isSchemaTooNew`、`SCHEMA_VERSION`。
- `modules/sync/googleDriveProvider.js`：SyncProvider over Drive v3 appDataFolder（list 分頁 / read alt=media + metadata version / write multipart-create + media-update / remove，注入式 authedFetch、name→fileId 快取），以 mock fetch 測請求構造與解析。

**測試**：175 單元測試全綠（12 套件）；`make` / `make release` 建置 OK；`esbuild` bundle 乾淨。**sync 層目前完全 inert**（無真 client_id → isConnected=false → 走 Noop），現有行為零影響。

---

## 🔜 剩餘步驟（接手指南）

> 接手環境：`git fetch && git checkout feat/workspace-drive-sync`。用 subagent-driven-development 逐任務做、每任務兩階段審查（沿用本專案慣例）。

### ⚠️ 外部前置（只有 repo 擁有者能做，可平行進行）
完成 `docs/google-drive-sync-setup.md`：Google Cloud Console 建 Chrome-Extension 型 OAuth client（綁 Web Store 擴充 ID）、設定同意畫面 + `drive.appdata` scope + 隱私政策 URL、把真實 client_id 取代 `manifest.json` 的佔位字串、加 `key` 讓 dev/prod 共用同一擴充 ID。**在此之前 sync 無法 live 驗證，但 E3/E4 可用 FakeSyncProvider 開發與測試。**

### E3 — 同步引擎（`modules/sync/syncEngine.js` + 接 `background.js`）
- 訂閱 `chrome.storage.onChanged`（workspaceSnapshots/Metadata），逐工作區 diff rev，push op 進 disk-first `syncQueue`（mark/ack、冪等）。
- `chrome.alarms` 定期（~10 分）flush + 拉取；**每次 SW 啟動重建 alarm**；onStartup 拉取；手動 Sync now。
- 用 `syncLogic` 的純函式做決策；`SyncProvider` 由 `isConnected()` 決定 Noop vs GoogleDriveProvider。
- pull 成功時**推進 baseRef:=remote.rev**（避免假衝突——見 syncLogic 的 3-way 註解）。
- 處理 schema 偏移、Drive-full、退避；**對 FakeSyncProvider 寫整合測試**（衝突/bootstrap/tombstone/queue 端到端）。

### E4 — Options Sync 區 + sidepanel 徽章
- `options.js` 加 `{id:'sync', labelKey:'settingsNavSync', render:renderSync}`（置於 features 後）；骨架同步畫、async IIFE 水合（仿 `renderAi`，因 buildNav eager 呼叫 render）。
- renderSync IA：連結/中斷帳號（顯示 email）→ 狀態（idle/last-synced/syncing/error/conflict/offline）→ Sync now / Restore from Drive →「Drive 上可還原」清單 → 逐工作區 opt-in toggle → 衝突檢視 → 隱私 fine-print。連線前 `modalManager.showConfirm` 同意。
- `modules/ui/settingsBridge.js`：加 `driveSyncStatus`（local 區）分支 → sidepanel 小徽章。
- `modules/workspace/workspaceUI.js`：manage 對話框列加唯讀雲端徽章。
- 控制項只 `setStorage`（無 CustomEvent，跨 context 靠 bridge）。

### E5 — 隱私 / i18n / 收尾
- ✅ **E5b（隱私揭露）已完成**：
  - `PRIVACY_POLICY.md`：新增「2.1 工作區 Google Drive 同步（選用，預設關閉）」小節（opt-in 逐工作區、上傳內容＝URL/標題/釘選/群組名稱與顏色、寫入使用者自己 Drive 的 `appDataFolder`／`drive.appdata`、不經開發者或第三方伺服器、`chrome.identity` 授權不存長期憑證、刪除途徑）；限定原「不上傳至任何伺服器」承諾為「開發者或第三方伺服器」；加入 **Limited Use 逐字聲明**；權限表新增 `identity` 列；生效日期加註更新。
  - 官網（**in-repo**）：`web/privacy.html` 同步新增 2.1 區塊、`identity` 權限列、Limited Use 逐字聲明，並透過 `data-i18n` 對應 14 語系 `web/locales/*.json`（新增 9 個 key：`privacy_s2_1_title/desc/li1..li5`、`privacy_limited_use`、`privacy_s4_td_identity`；修訂 `privacy_s2_li1`、`privacy_effective_date`）。Limited Use 聲明英文本體**逐字不翻譯**，僅標籤本地化。
  - ⚠️ **剩餘人工步驟（live site / OAuth brand verification）**：`web/` 為靜態官網原始碼，需在 OAuth 品牌驗證送審前**部署至 live 網域** `https://sidebar-for-tabs-bookmarks.taislife.work/privacy.html`，確認 Limited Use 逐字聲明於線上可見（Google 品牌驗證會檢查首頁／隱私頁是否刊載此聲明）。同時確認 Cloud Console 同意畫面填入此隱私頁 URL。
- `PRIVACY_POLICY.md`：新增 Drive 上傳條款（opt-in 工作區的分頁 URL+標題寫入使用者自己的 Drive appDataFolder、不經開發者伺服器）；官網放 **Limited Use 逐字聲明**。
- ~20 個新 i18n key × 14 語系（settingsNavSync、syncConnect/Disconnect、status、Sync now/Restore、隱私揭露、可還原、衝突檢視…）。
- 更新 `GEMINI.md` key_files（sync 模組）；`.agent/notes/` 收尾筆記。
- E2E（Puppeteer）：options Sync 區渲染、opt-in toggle 寫入、可還原清單、衝突檢視（注入 FakeSyncProvider 避免 CI 需真 OAuth）。
- 全量驗證（單元 + test:ci + make/make release），整批 merge 回 main。

### 為何不逐子批 merge
E1 單獨 merge 會把 `identity` 權限 + 佔位 OAuth 推給使用者（功能未就緒卻跳權限警告）。故整個 feature（含 OAuth 設定 + 隱私揭露）完整後再整批 merge。

## 主要風險（接手注意）
- 隱私/商店：首次有完整 URL+標題離開裝置；未更新隱私政策 + in-UI 同意 + 官網 Limited Use 聲明 → 商店退件風險。E5 必做。
- 無原子鎖：兩裝置同輪寫同一工作區仍可能 LWW clobber，以 conflicted-copy 兜底；**絕不可改用 modifiedTime LWW**（時鐘偏移→靜默丟失）。
- Chrome-only（getAuthToken）；Brave/Edge 無 sync，需 UI 明示。
- dev/prod 擴充 ID：OAuth client 綁 ID，`key` 管理錯誤只有 prod 壞。
- SW 被殺 / alarms 不保證跨重啟：佇列 disk-first + 冪等 + 啟動重建 alarm + 先寫檔再寫 index。
- appDataFolder 會消失（卸載/Manage Apps 清除）→ 視為可 re-seed、不自動刪本機。
