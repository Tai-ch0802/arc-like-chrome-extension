# NOTE 2026-05-29 — Phase 12 / 批 B：清理可視性

## 背景
近期大改後修正計畫共 4 批，本筆記為**批 B**（接續批 A 已合併進 main）。
- 批 A（已合併）：書籤貼 label + 局部目錄掃描。
- 批 B（本批，已完成）：死連結結果顯示資料夾路徑 + AI 分頁清理顯示 tab group badge。
- 批 C（待做）：切換工作區還原 tab group（#4）+ 分頁跨裝置同步決策（#5）。
- 批 D（待做）：設定 dialog → options page（#6）。
- 未排程：AI 書籤整理（全新功能）。

文件：
- spec：`docs/superpowers/specs/2026-05-29-cleanup-context-visibility-design.md`
- plan：`docs/superpowers/plans/2026-05-29-cleanup-context-visibility.md`

## 做了什麼
1. **AI 分頁清理 group badge**：
   - `modules/ui/groupColors.js` 新增純函式 `resolveTabGroupBadge(tab, groupMap)`（未分組 groupId===-1 或查無 → null）。
   - `aiCleanupUI.js`：`tabsForAi` 帶 `groupId`；送 AI 前查 `getTabGroupsInCurrentWindow()` 建 groupMap（try/catch，失敗則無 badge）；`renderList` 每列渲染 `.ai-cleanup-row__group`（彩色圓點 `.ai-cleanup-row__group-dot` + 群組名，未命名只顯點）。
2. **死連結結果顯示完整資料夾路徑**：
   - `bookmarkToolsUI.renderDeadLinksView`：用掃描所用 cache 建 `pathById`（與批 A scope 相容），unreachable 列以 `.bm-tools__dup-path` 顯示 `path.join(' / ')`。不動 deadLinkChecker 契約。
3. CSS：`.ai-cleanup-row__group(-dot/-name)`；死連結路徑沿用既有 class。

## 設計備忘
- group badge 群組名與死連結路徑皆用 `textContent`，無 XSS、不需新 i18n key。
- tab group 色票用 `GROUP_COLORS`（9 色，sidebar 渲染色，較淺）；標籤色票（批 A 的 `.bookmark-tag-dot`）是另一組 PRESET_COLORS。
- 修正 GEMINI.md 既有不準確：分頁清理是「預設勾選」，死連結檢查才是「預設未勾選」。

## 測試 / 狀態
- 新增單元 `tabGroupBadge.test.mjs`（5 例）；單元總計 72 綠。
- 新增 E2E `happy_path_cleanup_context.test.js`：scope 到單一資料夾掃 `http://nonexistent.invalid.test/`（DNS NXDOMAIN → unreachable），斷言列出 `.bm-tools__dup-path` 含資料夾名。跑兩次穩定。
- group badge 因需可用 on-device AI 模型，未做 E2E，以單元 + 手動驗證覆蓋。
- `npm run test:ci` happy path 全綠（theme_switch 偶發 timeout-retry 為既有，無關）；`make` 建置 OK。
- 分支 `feat/cleanup-context-visibility`，6 個實作 commit（`ffcd254`…`263c245`）；尚未 merge。
