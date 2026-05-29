# 批 B 設計：清理可視性（死連結資料夾路徑 + 分頁清理 group badge）

- **日期**：2026-05-29
- **狀態**：設計已核可，待寫實作計畫
- **範圍**：近期大改後修正第 2 批。涵蓋兩個「讓使用者看清楚要刪什麼」的顯示增強。
- **前置**：批 A 已合併（書籤局部掃描已可用）。

---

## 1. 問題

清理動作（刪書籤、關分頁）缺乏「歸屬脈絡」，使用者難以判斷要不要刪：

1. **死連結清理不顯示書籤所在資料夾**。重複書籤清理已顯示路徑（`.bm-tools__dup-path`），但死連結結果只有標題 + URL。
2. **AI 分頁清理不顯示分頁所屬的 tab group**。建議關閉的分頁清單只有標題 + 理由，看不出它屬於哪個 group，使用者不易判斷。

## 2. 目標

- 死連結結果每列顯示該書籤的**完整資料夾路徑**（鏡像重複清理）。
- AI 分頁清理結果每列顯示該分頁所屬 tab group 的**彩色小圓點 + 群組名**；未分組分頁不顯示。

### 非目標
- 不改 AI 模型/建議邏輯、不改死連結掃描演算法。
- 不動刪除安全閥。

## 3. 現況事實（已驗證）

| 項目 | 事實 | 出處 |
|------|------|------|
| 死連結結果渲染 | unreachable 列只 append title + url，無 path | `bookmarkToolsUI.js:330-353` |
| 重複清理路徑樣式 | `.bm-tools__dup-path`，`path.join(' / ')` | `bookmarkToolsUI.js:183-188` |
| 死連結掃描輸入/輸出 | 輸入 `{id,url,title}`；結果含 `bookmarkId,url,title,status` | `deadLinkChecker.js:33,86-96` |
| 書籤快取帶 path | `{id,title,url,parentId,type,path}` | `stateManager.js:432` |
| 批 A scope cache | `renderDeadLinksView` 已依 scope 取 `cache` | `bookmarkToolsUI.js`（批 A） |
| 分頁清理收集欄位 | `{id,title,url,lastAccessedMinutesAgo}`，無 groupId | `aiCleanupUI.js:66-76` |
| 分頁清理渲染 | `renderList(suggestions, tabById)`，列含 title + reason | `aiCleanupUI.js:105-142` |
| tab group 查詢 | `api.getTabGroupsInCurrentWindow()` | `apiManager.js` |
| group 色票 | `GROUP_COLORS`（9 色，含 orange） | `ui/groupColors.js:11` |
| 未分組 groupId | `chrome.tabGroups.TAB_GROUP_ID_NONE === -1` | Chrome API |

## 4. 設計

### 4.1 死連結結果顯示完整路徑

在 `renderDeadLinksView`（`bookmarkToolsUI.js`）：

- 取得用於掃描的 `cache`（已含 scope 邏輯）後，建 `const pathById = new Map(cache.map(b => [String(b.id), b.path || []]))`。
- 在 unreachable 結果的渲染迴圈裡，於 URL 行下方（或標題後）依 `pathById.get(r.bookmarkId)` append 一個路徑 span：若 path 非空，文字為 `r.path.join(' / ')`，套用既有 `.bm-tools__dup-path` 樣式（或新增等價 class `.bm-tools__path` 共用樣式）。
- **不改** `deadLinkChecker` 的輸入/輸出契約（用 renderer 端 map 查路徑，維持掃描模組單純）。

### 4.2 AI 分頁清理顯示 group badge

在 `aiCleanupUI.js`：

- `handleCleanupAction`：`tabsForAi` 的 map 額外帶 `groupId: t.groupId`。在送 AI 前後查一次 `const groups = await api.getTabGroupsInCurrentWindow();` 建 `groupMap = new Map(groups.map(g => [g.id, g]))`。
- `tabById` 仍保留 `groupId`（從 tabsForAi 帶入），`renderList(suggestions, tabById, groupMap)` 多收一個 `groupMap`。
- `renderList`：若 `tab.groupId != null && tab.groupId !== -1 && groupMap.has(tab.groupId)`，在 meta 內（標題列旁）插入 `.ai-cleanup-row__group` badge：一顆 `.ai-cleanup-row__group-dot`（背景 `GROUP_COLORS[group.color]`）+ 群組名文字（`group.title`；空字串時只顯示色點）。未分組分頁不渲染 badge。

### 4.3 CSS（`sidepanel.css`）

- 若死連結沿用 `.bm-tools__dup-path` 即無需新增；若改用 `.bm-tools__path` 則加等價樣式。
- 新增 `.ai-cleanup-row__group`（inline-flex、小字、次要色）與 `.ai-cleanup-row__group-dot`（8px 圓點，背景由 inline style 帶入色）。

## 5. 影響面

- 改動：`bookmarkToolsUI.js`（死連結路徑）、`aiCleanupUI.js`（group 收集 + 渲染）、`sidepanel.css`。
- i18n：群組名為使用者資料、路徑為書籤資料夾名，**不需新 key**。
- 不影響：批 A 的 scope（路徑顯示與 scope 相容）、刪除安全閥、AI 邏輯。

## 6. 測試策略

- E2E（Puppeteer）：
  - 分頁 group badge：建立一個 tab group 含分頁，觸發 AI 清理（或直接驗證 `renderList` 對帶 groupId 的資料渲染出 `.ai-cleanup-row__group-dot` 與群組名）。因 AI 模型在測試環境可能不可用，優先以「對 renderList 餵已知資料」的方式驗證渲染，或在 group 存在時斷言 badge 出現。
  - 死連結路徑：因死連結掃描依賴網路，E2E 較不穩；以「對 renderDeadLinksView 的路徑查找與 DOM 結構」為主，必要時用可控 stub。實作計畫會決定最務實的驗證點（可能以單元測試覆蓋 pathById 對映 + 手動驗證渲染）。

## 7. 後續批次（備忘）
- 批 C：切換工作區還原 tab group（#4）+ 分頁跨裝置同步決策（#5）。
- 批 D：設定 dialog → options page（#6）。
- 未排程：AI 書籤整理。
