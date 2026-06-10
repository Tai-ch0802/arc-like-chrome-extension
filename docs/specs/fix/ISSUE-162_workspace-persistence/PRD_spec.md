# [Fix/T2] Workspace 持久化與 Drive 同步互動重設計 — PRD

| Attribute | Details |
| :--- | :--- |
| **Status** | Approved（使用者於 #162 指示「所有項目都得修正、按規劃順序實作」，覆寫 T2 事前 gate；spec 隨 PR 審） |
| **Issue** | #162（WP1：F1/F2/F3/F4/F5/F7） |
| **Version** | v1.0 (2026-06-10) |

## 1. 背景與問題

四路對抗式審查（#162）確認六項持久化／同步互動缺陷，其中兩項可造成**靜默資料遺失**：

- **F1（High）**：`persistWorkspaces()` 每次把整個 in-memory mirror 覆寫到 `workspaceMetadata`(sync) 與 `workspaceSnapshots`(local) 兩把大 key。sidepanel 與 background SW 各持 mirror，任何「讀→寫」交錯都會用舊資料覆寫對方剛寫入的變更（rename 被回滾、其他工作區的最新快照被回滾）。背景持續快照（每 2s/視窗）使這個既有競態從偶發變高頻。
- **F2（High）**：重啟 rebind 的 0.6 相似度門檻無「領先次佳」邊際要求；兩個基底分頁相似的工作區會互相誤綁，誤綁後 auto-snapshot 直接覆寫錯誤工作區的快照並推上 Drive —— 破壞性誤綁。
- **F3（Med）**：Drive pull 對 live-bound 工作區仍整顆套用遠端 `tabSnapshot`，下一個 tab 事件立即以本地視窗重新快照→push；兩台裝置都 bound 時每個 pull 週期互相產生新 rev，永不收斂。
- **F4（Med）**：`engineWriteEcho` 僅比對 rev；rev 碰撞時真實本地編輯被當 echo 吞掉，本地與 Drive 同 rev 不同內容、靜默分歧。
- **F5（Med）**：無單一綁定不變式；兩視窗綁同工作區時快照來回震盪。
- **F7（Low）**：每次快照都寫 `chrome.storage.sync`（rev/updatedAt/lastActiveAt 在 metadata），多視窗持續瀏覽可逼近 1800 writes/hour 配額。

## 2. User Stories

| ID | As a | I want | So that |
|---|---|---|---|
| US-01 | 多視窗使用者 | 在 A 視窗改工作區名稱時不被背景快照回滾 | 我的編輯永遠不會無聲消失 |
| US-02 | 多裝置使用者 | 兩台電腦同時開著同一個已同步工作區也不會互相覆蓋分頁 | Drive 同步收斂、不產生無限 rev |
| US-03 | 重啟使用者 | 模板相似的兩個工作區不會在重啟後被綁錯 | 不會因誤綁而毀掉另一個工作區的快照 |

## 3. Functional Requirements（EARS）

- **FR-01**：WHEN 任一 context 持久化單一工作區的變更，THE SYSTEM SHALL 僅寫入該工作區自身的 storage key，不得觸碰其他工作區的資料。（→ per-id keys）
- **FR-02**：WHEN 背景 auto-snapshot 僅變更分頁內容，THE SYSTEM SHALL 僅寫入 `chrome.storage.local`，不得產生 `chrome.storage.sync` 寫入。
- **FR-03**：WHEN 重啟 rebind 的最佳匹配分數未領先同視窗次佳候選 ≥ 0.15，THE SYSTEM SHALL 拒絕綁定該視窗（寧可留白讓使用者手動選）。
- **FR-04**：WHEN Drive pull 要套用遠端內容到 live-bound 工作區，THE SYSTEM SHALL 僅套用 identity metadata 與 rev/updatedAt（採納排序權），保留本地 tabSnapshot。
- **FR-05**：WHEN 比對 engine 寫入 echo，THE SYSTEM SHALL 同時比對 rev 與 updatedAt。
- **FR-06**：WHEN `setActiveWorkspace(windowId, wsId)` 綁定時，THE SYSTEM SHALL 移除其他視窗對同一 wsId 的綁定（單一綁定不變式）。
- **FR-07**：WHEN 既有安裝（v1 大 key schema）首次以新版啟動，THE SYSTEM SHALL 無損遷移至 per-id schema，且失敗時保留原資料可重試。

## 4. Acceptance Criteria（Given-When-Then）

- **AC-01**（F1）：Given 兩個獨立 module context 共用同一 fake storage，When A rename 工作區 X 與 B 對 X auto-snapshot 交錯執行，Then 最終 storage 同時保有新名稱與新快照。
- **AC-02**（F1 跨 id）：Given 同上，When A 編輯工作區 X、B 快照工作區 Y 交錯，Then X 與 Y 的變更皆不遺失。
- **AC-03**（F2）：Given 工作區 A=[g,c,n,a-doc]、B=[g,c,n,b-doc]，When 視窗 [g,c,n] 進行匹配，Then 不綁定任何工作區；Given 僅 A 存在，Then 綁定 A。
- **AC-04**（F3）：Given 工作區 live-bound 且本地快照 ≠ 遠端，When applyRemoteSnapshot，Then 本地 tabSnapshot 不變、rev/updatedAt 採遠端值、metadata 更新。
- **AC-05**（F7）：Given 已綁定視窗，When auto-snapshot 觸發且僅 tab 內容變更，Then 該次持久化只發生 local 寫入（unit test 以 fake storage 計數）。
- **AC-06**（F7 遷移）：Given v1 schema 資料（含 Phase 6 legacy），When initWorkspaces，Then per-id keys 建立、合併視圖與遷移前一致、legacy sync key 移除、legacy local keys 保留為備援。
- **AC-07**：`npm run test:unit` 全綠；happy_path E2E（workspace + drive sync section）全綠。

## 5. Out of Scope

- ~~`windowWorkspaceMap` 的 key 級競態（綁定遺失可自癒，低風險，本次僅文件化）~~
  **v1.1 移入 In Scope**：實作期間 E2E 證明同 context 的 debounce reload 即可穩定觸發
  全表覆寫清空綁定，已以 `mutateWindowMap`（delta + read→merge→write）修正。
- WP2 的 `windows.onCreated` rebind 與 lastActiveAt 排序保護（另一 PR）。
- Drive 端 schema（檔案格式 rev/updatedAt 不變，無 SCHEMA_VERSION bump）。

## 6. 風險與緩解

- **混版裝置**（舊版讀 `workspaceMetadata`、新版寫 `wsMeta_*`）：遷移時刪除 legacy sync key，舊版裝置在更新前暫時看不到工作區清單（local 快照不受影響，更新後自行遷移）。可接受 —— extension 自動更新收斂快。
- **sync get(null) 掃描**：sync 區資料量小（設定 + metadata），每次 init 全掃成本可忽略；**不可**對 local get(null)（自訂背景圖可達 MB 級），ids 一律由 sync 掃描推導。
