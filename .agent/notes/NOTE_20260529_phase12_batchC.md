# NOTE 2026-05-29 — Phase 12 / 批 C：切換工作區還原 tab group

## 背景
近期大改後修正計畫 4 批，本筆記為**批 C**（接續 A、B 已合併）。
- ✅ 批 A：書籤貼 label + 局部目錄掃描。
- ✅ 批 B：死連結資料夾路徑 + AI 分頁清理 group badge。
- ✅ 批 C（本批，已完成）：切換工作區還原 tab group（#4）。**只做 #4**。
- ⏳ 批 D：設定 dialog → 獨立 options page（#6）。
- ⏳ #5 分頁內容跨裝置同步：**延後另開一批**，方向是用使用者**自己的 Google Drive** 當同步持久層（待批 D options page 之後）。見 memory `workspace-sync-google-drive-direction`。
- ⏳ 未排程：AI 書籤整理。

文件：spec `docs/superpowers/specs/2026-05-29-workspace-restore-groups-design.md`；plan `docs/superpowers/plans/2026-05-29-workspace-restore-groups.md`。

## 做了什麼
根因：`TabSnapshot` 只存 `{url,title,pinned}`、`switchWorkspace` 逐個 `tabs.create` 不重建 group。

- **`TabSnapshot` 擴充**：`groupKey`(原始 groupId 當快照內分群鍵)、`groupTitle`、`groupColor`。
- **純函式（單元測試 8 例）**：
  - `buildSnapshotFromTabs(tabs, groupsById)`：映射 + 捕捉 group（過濾非 http/file/ftp）。
  - `clusterCreatedTabsByGroup(snapshotTabs, createdTabIds)`：依 groupKey 分群，排除建立失敗 index、未分組、pinned。
- **`snapshotWindowTabs`**：併查 `chrome.tabGroups.query({windowId})` → 用 buildSnapshotFromTabs。
- **`switchWorkspace`**：還原迴圈記錄 `createdTabIds`（失敗 push null 保持對齊）；關閉舊分頁後、`setActiveWorkspace` 前，**best-effort** 用 `clusterCreatedTabsByGroup` + `api.addTabToNewGroup` 重建 group（雙層 try/catch，失敗不中斷切換）。

## 設計備忘
- 舊快照（無 group 欄位）還原時不產生 cluster → 與現況相同，免遷移。
- pinned 分頁不分群（Chrome 不允許）→ 在 cluster 階段排除。
- group 欄位只增加 local snapshot 體積，不入 sync metadata，不影響配額。
- 已知良性外觀行為：`chrome.tabs.group` 會把同群分頁拉成相鄰（交錯群組順序會被正規化）；無效/空 color 由 inner catch 吸收。

## 測試 / 狀態
- 單元 80 綠（含 workspaceGroups 8 例）。
- E2E `happy_path_workspace_group_restore.test.js`：在**獨立 scratch window** 操作（不碰 Puppeteer 控制頁），動態 import 跑真正的 switchWorkspace，輪詢避免 race（新視窗分頁初期是 pendingUrl）；三次穩定通過、CI 全綠。
- `npm run test:ci` 43 綠（settings_panel / theme_switch 偶發 retry 為既有，無關）；`make` OK。
- 分支 `feat/workspace-restore-groups`，9 個實作/文件 commit；尚未 merge。
