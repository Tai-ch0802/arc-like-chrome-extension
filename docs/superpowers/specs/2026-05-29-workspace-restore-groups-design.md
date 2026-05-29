# 批 C 設計：切換工作區還原 tab group

- **日期**：2026-05-29
- **狀態**：設計已核可，待寫實作計畫
- **範圍**：近期大改後修正第 3 批。**只涵蓋 #4**（切換工作區時連同 tab group 一起還原）。
- **明確排除**：#5 分頁內容跨裝置同步——延後另開一批，方向是用使用者自己的 Google Drive 當同步持久層（待批 D options page 之後）。

---

## 1. 問題

切換工作區時，原本分好的 tab group 會被解散，還原後只剩一堆獨立分頁。

根因（已驗證）：
- `TabSnapshot` 只存 `{ url, title, pinned }`，**完全沒有 group 資訊**（`workspaceManager.js:36-40, 203-214`）。
- `switchWorkspace` 還原時逐個 `chrome.tabs.create`，**沒有任何重建 group 的邏輯**（`workspaceManager.js:266-279`）。

## 2. 目標

切換到某工作區時，還原的分頁應**重建原本的 tab group**（分群、群組標題、群組顏色）。未分組的分頁維持獨立。

### 非目標
- 不做分頁內容跨裝置同步（#5）。
- 不改「先開後關」「建失敗不關舊分頁」等既有安全邏輯。
- 不還原 group 的折疊狀態（collapsed）——Chrome 還原後預設展開即可，非必要。

## 3. 現況事實（已驗證）

| 項目 | 事實 | 出處 |
|------|------|------|
| TabSnapshot | `{url,title,pinned}`，無 group | `workspaceManager.js:36-40` |
| 快照產生 | `snapshotWindowTabs` 只 map url/title/pinned | `:203-214` |
| 還原 | 逐個 `chrome.tabs.create`，無分群 | `:266-279` |
| 既有 group 建立輔助 | `api.addTabToNewGroup(tabIds, title, color, windowId)`：`chrome.tabs.group` + `tabGroups.update({title,color})` | `apiManager.js:24-33` |
| group 查詢 | `chrome.tabGroups.query({windowId})` | `apiManager.js:19` |
| 未分組 groupId | `chrome.tabGroups.TAB_GROUP_ID_NONE === -1` | Chrome API |
| group 色票 | grey/blue/red/yellow/green/pink/purple/cyan/orange | Chrome tabGroups colors |

## 4. 設計

### 4.1 擴充 TabSnapshot

```
@typedef TabSnapshot {
  url: string, title: string, pinned?: boolean,
  groupKey?: number,    // 快照當下的原始 groupId，僅作「同一快照內分群」的識別鍵
  groupTitle?: string,
  groupColor?: string,
}
```
`groupKey` 不跨 session 有意義，只用來在還原時把「原本同一群」的分頁聚在一起。

### 4.2 快照時捕捉 group（pure helper + 薄 API 層）

- 新增**純函式** `buildSnapshotFromTabs(tabs, groupsById)`：把 `chrome.tabs.query` 的結果（已過濾 url）映射成 TabSnapshot[]；對 `groupId !== -1` 且 `groupsById` 有的分頁，帶上 `groupKey/groupTitle/groupColor`。可單元測試。
- `snapshotWindowTabs(windowId)` 改為：同時 `chrome.tabs.query` 與 `chrome.tabGroups.query({windowId})`，建 `groupsById = Map(groupId→{title,color})`，呼叫 `buildSnapshotFromTabs`。

### 4.3 還原時重建 group（pure helper + 薄 API 層）

- 還原迴圈改為記錄每個成功建立的分頁 id 與其對應 snapshot 的 `groupKey`（`chrome.tabs.create` 回傳 tab，取 `newTab.id`）。
- 新增**純函式** `clusterCreatedTabsByGroup(snapshotTabs, createdTabIds)`：回傳 `[{ tabIds: number[], title, color }]`（依 `groupKey` 分群，略過無 groupKey 者，保留出現順序）。可單元測試。
- 全部分頁建立完成後，對每個 cluster 呼叫 `api.addTabToNewGroup(cluster.tabIds, cluster.title, cluster.color, windowId)`。整段包 try/catch：**還原 group 是 best-effort**，失敗只 log，不影響已還原的分頁與切換流程。

### 4.4 相容性
- 舊快照（無 group 欄位）還原時 `clusterCreatedTabsByGroup` 不會產生任何 cluster → 行為與現況相同（純獨立分頁），不需遷移。
- group 欄位只增加 local snapshot 體積（不入 sync metadata），不影響配額。

## 5. 影響面

- 改動：`workspaceManager.js`（TabSnapshot typedef、`snapshotWindowTabs`、`switchWorkspace` 還原、兩個純函式）。
- 不影響：metadata sync、windowWorkspaceMap、遷移邏輯、workspaceUI。
- i18n：無新字串。

## 6. 邊界與安全
- 還原 group 失敗（API 錯誤）不可中斷切換；分頁已開、舊分頁照常處理。
- 只對成功建立的分頁分群（建失敗的 index 不納入 cluster）。
- pinned 分頁不分群（Chrome 不允許 pinned 分頁進 group；`addTabToNewGroup` 對 pinned 分頁可能失敗 → 由 try/catch 吸收，或在 cluster 階段排除 pinned）。設計採**在 cluster 階段排除 pinned 分頁**，避免整群 group 呼叫失敗。

## 7. 測試策略
- 單元：`buildSnapshotFromTabs`（含/不含 group、未分組、url 過濾）；`clusterCreatedTabsByGroup`（多群、單群、無群、pinned 排除、建失敗 index 缺漏對齊）。
- E2E（Puppeteer）：較重且操作整窗，視 harness 穩定度而定——以單元覆蓋核心邏輯為主，E2E 能穩定就加（建一個 group → 快照 → 切走再切回 → 斷言 group 重建）。實作計畫決定務實驗證點。

## 8. 後續（備忘）
- 批 D：設定 dialog → options page（#6）。
- #5 分頁跨裝置同步：批 D 之後，用 Google Drive 持久層另開一批。
- 未排程：AI 書籤整理。
