# SPEC — BASE-021 以目前視窗覆蓋既有工作區

| 欄位 | 值 |
|---|---|
| 分級 | T1（單檔 SPEC 隨 PR 審） |
| 來源 | 使用者需求：新開視窗無法繼承既有工作區，希望能反向用新視窗的配置覆蓋過去 |
| 分級理由 | 不動 storage schema、不動 manifest、不新增跨 context 協定；核心邏輯完全複用既有已測試的 primitive，`workspaceManager.js` 零改動 |

## 背景與問題

工作區的分頁快照只有兩條寫入路徑：**建立工作區時**（`createWorkspace({snapshotWindowId})`），以及**背景自動快照**（`workspaceLifecycle.js` 的 debounce，只對「已綁定」的視窗生效）。

因此出現一個缺口：使用者另開一個新的 Chrome 視窗、在裡面整理好一批分頁後，這個視窗**沒有綁定任何工作區**，既有的 `stock` 工作區也就無從更新——UI 上唯一能做的是「新建工作區」，但那會多出一個重複的工作區，而不是更新既有的那個。

使用者要的是反向操作：**用目前視窗的配置覆蓋既有工作區，並讓這個視窗接手該工作區**。

## 方案

在工作區管理面板的每一列，新增一顆「以目前視窗覆蓋」按鈕（icon: `download`，語意＝把目前視窗存進這個工作區）。**僅在該工作區未綁定到目前視窗時顯示**——已綁定者由背景自動快照持續更新，手動覆蓋沒有意義。

核心邏輯只有兩行，**順序不可調換**：

```js
await wsManager.setActiveWorkspace(currentWindowId, ws.id);   // 先綁定
await wsManager.snapshotIntoWorkspace(ws.id, currentWindowId); // 再快照
```

### 為什麼順序是關鍵（本 SPEC 最重要的一點）

`background.js` 的 `applyRemoteSnapshot` 依賴會先檢查 `isWorkspaceBound(id)`：**只有當該工作區在本機有活視窗綁定時**，Drive 拉取才會走 `keepLocalSnapshot`（保留本機 tabs、只採納遠端 rev）。

若順序反過來（先快照後綁定），在「已寫入新快照、但尚未綁定」的空窗期若剛好有遠端更新抵達，`keepLocalSnapshot` 不生效，**遠端快照會把這次覆蓋整個蓋回去**，使用者的操作靜默消失。這個空窗已用 unit test 鎖住（見 Test Impact）。

### UI 端預算快照的理由

`snapshotIntoWorkspace` 對三種結果都回傳同一個 `ws` 物件：成功寫入、空快照被 guard 擋下、內容相同而跳過。**呼叫端無法從回傳值分辨是否真的寫入**。

因此 UI 先用已 export 的純函式 `buildSnapshotFromTabs(tabs, null)` 預算一次，用途有二：
1. 確認框顯示準確的「舊 N 個分頁 → 新 M 個分頁」
2. 攔下 `M === 0` 的情況（全 `chrome://` 的新視窗）——否則按鈕按下去會**完全沒有反應**（guard 靜默 return），使用者無從得知發生什麼事

### 護欄

| 風險 | 護欄 |
|---|---|
| 覆寫不可逆（`wsSnap_<id>` 直接 set，無 undo、無 tombstone） | destructive 確認框（`confirmButtonClass: 'danger'`），明列雙方分頁數 |
| 舊視窗被靜默解綁（單一綁定不變式的副作用） | 確認框文案明講「若有其他視窗綁定此工作區，該視窗會被解除綁定」 |
| 全 `chrome://` 視窗 → 靜默無效 | 前置預算攔截，顯示「沒有可儲存的分頁」 |
| 覆蓋被 Drive 回捲 | 綁定先行（見上）；已同步的工作區另有 `.conflict-*.json` 作為最後保險 |

### 排除的替代方案

- **合併（把新分頁附加到既有配置）**：使用者明確要的是「取代」語意；合併會累積出愈來愈臃腫的工作區。
- **只綁定不覆蓋快照**：綁定後要等下一次背景快照才會更新，語意含糊且有時間差。
- **未綁定時在側邊欄主動提示**：可另案處理；本次先做管理面板的常駐入口，不新增 UI 區塊。

## 影響面

| 檔案 | 改動 |
|---|---|
| `modules/workspace/workspaceUI.js` | 新增 `handleOverwrite()`；`buildManageRow` 在 `!isActive` 時插入覆蓋按鈕 |
| `_locales/*/messages.json` × 14 | 新增 7 個 key（`workspaceOverwrite*`），426 → 433 |
| `docs/specs/feature/BASE-021_workspace-overwrite/SPEC.md` | 本文件 |

- **`modules/workspace/workspaceManager.js` 零改動** — `setActiveWorkspace` / `snapshotIntoWorkspace` / `buildSnapshotFromTabs` 皆已 export 且語意剛好。
- **無 storage schema 變更**：只寫既有的 `wsSnap_<id>`（local）與 `windowWorkspaceMap`（local）；`wsMeta_<id>`（sync）僅因 `setActiveWorkspace` 預設 `touch:true` 而 bump `lastActiveAt`。
- **無 manifest / 權限變更**。
- **CSS 零改動**：複用既有 `.workspace-manage__btn`。

## Test Impact

`usecase_tests/unit_tests/workspacePersistence.test.mjs` 新增 describe「以目前視窗覆蓋工作區」4 例（複用既有 fake chrome.storage harness）：

1. **正常流程**：綁定→快照後，`wsSnap_X.tabs` 換新、`rev` +1、舊視窗解綁、`isWorkspaceBound` 為 true
2. **★ 順序回歸鎖**：故意用錯誤順序（先快照後綁定），證明會留下未綁定空窗，且此時抵達的遠端更新會把覆蓋成果整個蓋掉
3. **空快照 guard**：全 `chrome://` 視窗不會清空既有配置、不 bump rev（此 guard 原本無測試涵蓋）
4. **`buildSnapshotFromTabs` 濾除瀏覽器內部頁**：UI 預判「無可儲存分頁」的依據

驗證指令：`npx jest --testPathPatterns 'workspacePersistence'`、`npm run test:unit`、`npm run test:ci`

## 驗收條件

- [ ] 管理面板中，**非**目前視窗所綁定的工作區列會出現覆蓋按鈕；目前視窗已綁定的那一列不出現
- [ ] 點擊後顯示 destructive 確認框，內容包含工作區名稱、舊分頁數、新分頁數，以及「其他視窗會被解除綁定」的提示
- [ ] 確認後：該工作區快照變成目前視窗的分頁、目前視窗綁定到該工作區、該列標籤的分頁數即時更新
- [ ] 取消則完全不變更
- [ ] 在只有 `chrome://newtab` 的視窗執行 → 顯示「沒有可儲存的分頁」，不做任何寫入
- [ ] 覆蓋後 `isWorkspaceBound(id)` 為 true（Drive 回捲保護生效）
- [ ] 7 個 i18n key 於 14 個語系皆齊備，placeholder（`{ws}`×2、`{old}`、`{new}`）保留完整
