# NOTE 2026-05-29 — Phase 12 / 批 A：書籤貼標籤 + 局部目錄掃描

## 背景
近期一波大改後使用者回報多個問題，盤點為 6 項、收斂成 4 批依序處理（spec → plan → subagent 實作）。本筆記為**批 A**。

- 批 A（本批，已完成）：書籤貼 label 的 UI + 書籤列顯示標籤；局部目錄掃描入口。
- 批 B（待做）：死連結結果顯示資料夾路徑 + 分頁清理顯示 tab group badge。
- 批 C（待做）：切換工作區還原 tab group（#4，根因：TabSnapshot 只存 url/title/pinned，switchWorkspace 逐個 tabs.create 不重建 group）；工作區「分頁內容」是否跨裝置同步的決策（#5，現況：metadata 在 sync、snapshot 在 local，使用者選「先看方案再決定」）。
- 批 D（待做）：設定 dialog → 獨立 HTML options page（settingManager.js ~818 行、約 16 類設定、manifest 無 options_page）。
- 未排程：**AI 書籤整理**（全新功能，現不存在；使用者選擇「排除，之後單獨開一批」）。

文件：
- spec：`docs/superpowers/specs/2026-05-29-bookmark-tagging-and-scoped-scan-design.md`
- plan：`docs/superpowers/plans/2026-05-29-bookmark-tagging-scoped-scan.md`

## 批 A 做了什麼
1. **書籤貼標籤**（tagManager 資料層原本就齊全，只缺 UI）：
   - 新 `modules/bookmark/tagPicker.js`：`createTagPicker(initialTagIds)` → `{element, getSelectedTagIds}`（只呈現+回傳，寫入由呼叫端決定）；純函式 `diffTagSelection(original, selected)`。
   - 新 `modules/ui/bookmarkContextMenu.js`：書籤/資料夾右鍵選單（與分頁 contextMenuManager 分離）。
   - `bookmarkRenderer.js`：委派 contextmenu、書籤列渲染 `.bookmark-tag-dot`、編輯對話框加 `tags` custom 欄位。
   - `modalManager.showFormDialog` 新增 `type:'custom'` 欄位機制。
2. **局部目錄掃描**：
   - `bookmarkUtils.filterBookmarksUnderFolder`（純函式，DFS）+ `stateManager.getBookmarkCacheUnderFolder`。
   - `dedupe.findDuplicates(items?)` 可傳限定清單；`bookmarkToolsUI` 加範圍列 + `modalManager.pickFolder`，右鍵資料夾「整理此資料夾」帶 scopeFolderId/scopeFolderName。
3. i18n：7 個 key × 14 語系；CSS：標籤圓點/tag-picker/scope 列。
4. 測試：3 支單元（filterBookmarksUnderFolder / findDuplicates(items) / diffTagSelection）+ 2 支 E2E（貼標籤含右鍵 popover 與「+新增標籤」、局部掃描 scoped vs all）。

## 實作過程攔截到的真實 bug（subagent review 發現）
1. **右鍵 popover 點 checkbox 會關閉選單**：document `click` 直接綁 `closeMenu`，未排除選單內點擊 → 改為 outside-only（`handleOutside`）。commit `9ed2b36`。
2. **右鍵 popover「+ 新增標籤」死路**：createTagPicker 建立後沒 dispatch `tagselectionchange`（popover 不持久化）+ 新增標籤 prompt 在選單外觸發 outside-close。修法：createTagPicker 建立後 dispatch 事件；handleOutside 忽略 `.modal-overlay` 內點擊。commit `a3d4f96`。
3. spec 落差：右鍵開啟掃描時範圍標籤只顯示「選定的資料夾」，未顯示實際資料夾名 → 把 `node.title` 一路傳到 `openBookmarkToolsDialog({scopeFolderName})`。commit `61b579d`。

## 設計慣例備忘
- `bmToolsScopeStatus` 的 `{name}`/`{n}` 是 JS String.replace 取代，非 chrome i18n placeholder。
- 標籤色票沿用 PRESET_COLORS 八色，CSS `.bookmark-tag-dot[data-color]` 與 `.bm-tools__tag-chip[data-color]` 同 hex。
- scope 掃描完整保留既有刪除安全閥（死連結離線預檢 / 高失敗率警告 / 預設不勾；重複組至少留一份）。

## 狀態
- 分支 `feat/bookmark-tagging-scoped-scan`，18 個實作 commit（`657de74`…`a3d4f96`）。
- 單元 67 綠；E2E happy path 全綠（15 套件/39 測試，settings 那支為既有偶發 flaky，retry 後過）；`make` 建置 OK。
- 尚未開 PR、尚未 merge；瀏覽器手動煙霧測試待人工確認。
