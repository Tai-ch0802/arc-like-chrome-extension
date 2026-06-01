# 書籤標籤強化：顏色選擇 + tag: 搜尋篩選

- **日期**：2026-06-01
- **狀態**：設計待核可
- **分支**：`feat/bookmark-tag-color-and-search`（從合併後的 main）
- **背景**：批 A 加入了書籤標籤（多標籤、書籤列彩色圓點、Tags 管理分頁），但有兩個缺口讓它形同半成品：(1) 管理 UI 無法設定標籤顏色（資料層支援、UI 沒提供 → 全是預設藍），(2) 搜尋無法依標籤篩選。本次補齊。

## 目標
1. **標籤顏色**：建立／編輯標籤時可選顏色（8 色，沿用 `tagManager.getPresetColors()`）；書籤列圓點與 Tags 分頁 chip 立即反映。
2. **tag: 搜尋篩選**：在搜尋框輸入 `tag:工作` 即只列出貼了該標籤的書籤；支援 `tag:"含空白 名稱"`；可與一般關鍵字併用（tag AND keyword）；點書籤列的標籤圓點即自動以該標籤篩選。

### 非目標
- 不改標籤資料結構（`{id,name,color,createdAt}` 已足夠）。
- 不做標籤的階層/群組、不做分頁(tab)依標籤篩選（標籤只屬書籤）。

## 現況事實（已驗證）
| 項目 | 事實 | 出處 |
|------|------|------|
| 標籤資料層支援顏色 | `createTag({name,color})`、`updateTag(id,{color})`、`getPresetColors()`(8 色) | `tagManager.js:54-82` |
| 管理 UI 無顏色 | 建立/改名都只 `modal.showPrompt`(名稱) | `bookmarkToolsUI.js:117,147` |
| 色票 UI 範本 | `modalManager.showCreateGroupDialog`：名稱輸入 + 色票 swatch + 鍵盤導航 | `modalManager.js` |
| 圓點渲染 | `bookmark-tag-dot[data-color]`、`title=tag.name`，於 `updateBookmarkElement` | `bookmarkRenderer.js`（批 A） |
| 取書籤標籤 | `tagManager.getTagsForBookmark(id)` → `[{id,name,color}]` | `tagManager.js:41` |
| 搜尋入口 | `handleSearch`：`query.split(/\s+/)` → keywords；`filterBookmarks(keywords,regexes)` | `searchManager.js:11-43,337` |
| 書籤過濾 | 比對 `matchesAnyKeyword(title)`/`extractDomain(url)`；空 query → 還原完整視圖 | `searchManager.js:337-382` |
| 純函式測試慣例 | `usecase_tests/unit_tests/*.test.mjs`（node、無 chrome） | — |

## 設計

### A. 標籤顏色
- 新增 `modalManager.showTagDialog({ title, defaultName='', defaultColor='blue' })` → resolve `{name, color}` 或 `null`。
  - 結構仿 `showCreateGroupDialog`：名稱 `<input>` + 一排色票（用 `tagManager.getPresetColors()` 的 8 色，色值對映既有 `.bm-tools__tag-chip[data-color]` 的 CSS），含鍵盤可選、focus trap（沿用 createModal）。
- `bookmarkToolsUI`：
  - **建立標籤**：`renderTagsView` 的 create 按鈕改呼叫 `showTagDialog({title:建立標籤})` → `createTag({name,color})`。
  - **編輯標籤**：`buildTagRow` 的 rename(✏️) 按鈕改為「編輯」，呼叫 `showTagDialog({title:編輯標籤, defaultName:tag.name, defaultColor:tag.color})` → `updateTag(id,{name,color})`，並就地更新該列 chip 的 `data-color` 與文字。
  - 變更標籤顏色後，書籤列圓點需反映：沿用既有 `refreshBookmarksRequired` 事件觸發重繪（圓點讀 `tag.color`）。
- i18n：新增少量 key（編輯標籤標題、顏色標籤等），沿用 fallback；之後補 14 語系。

### B. tag: 搜尋篩選
- **純函式** `parseSearchQuery(query)` → `{ keywords: string[], tags: string[] }`：
  - 抽出 `tag:"含空白"` 與 `tag:單詞` token（tag 名稱小寫化、去引號）放入 `tags`；其餘空白分隔詞放入 `keywords`。
  - 例：`react tag:工作 tag:"side pj"` → `{keywords:['react'], tags:['工作','side pj']}`。
- **純函式** `bookmarkMatchesTags(bookmarkTagNames, requiredTagNames)` → bool：requiredTagNames 皆需出現在 bookmarkTagNames（大小寫不敏感、**精確比對**名稱；AND）；requiredTagNames 為空 → true。
- `handleSearch`：改用 `parseSearchQuery` 取得 `{keywords, tags}`；highlight regexes 只用 keywords（tag token 不高亮）；把 `tags` 傳入 `filterBookmarks`。空 query（keywords 與 tags 皆空）→ 維持現有「還原完整視圖」行為。
- `filterBookmarks(keywords, regexes, tags=[])`：書籤需同時滿足
  - keyword 條件：`keywords.length===0` 視為通過，否則 title/url 命中（沿用現有邏輯）；且
  - tag 條件：`tags.length===0` 視為通過，否則 `bookmarkMatchesTags(getTagsForBookmark(item.id).map(t=>t.name), tags)`。
  - 只有 tag、無 keyword 時：列出所有具該標籤的書籤（keyword 條件自動通過）。
- **點圓點篩選**：`bookmark-tag-dot` 加 `data-tag-name`（=tag.name）；在書籤容器的委派 click 處理（`bookmarkRenderer` initBookmarkListeners）攔截圓點點擊 → 設 `searchBox.value = tag:<name>`（名稱含空白則加引號）→ 觸發搜尋（dispatch `input` 事件，沿用既有 debounce listener）。點擊不應同時觸發開啟書籤（stopPropagation）。

## 影響面
- 改：`modalManager.js`(showTagDialog)、`bookmarkToolsUI.js`(建立/編輯標籤接色票)、`searchManager.js`(parse + filter tags)、`bookmarkRenderer.js`(圓點 data-tag-name + 點擊篩選)、`sidepanel.css`(色票/編輯 UI 微調，多半可重用既有 swatch 樣式)、`_locales`(少量新 key)。
- 不影響：標籤資料層、Drive 同步、其他搜尋（分頁/閱讀清單只比對 keyword，tag token 對它們無作用——需確認 tag-only 查詢時分頁/閱讀清單合理地不誤篩；做法：分頁/閱讀清單仍只吃 keywords，tag token 已被 parseSearchQuery 分離，故它們看到的是去掉 tag token 後的 keywords）。

## 測試策略
- 單元（TDD）：`parseSearchQuery`（單詞/引號/混合/僅 tag/空）、`bookmarkMatchesTags`（AND、大小寫、空集合、不符）。
- E2E（Puppeteer，沿用既有 harness）：
  - 建立帶顏色標籤 → 書籤列圓點為該色；編輯標籤改色 → 圓點更新。
  - 對書籤貼標籤後，搜尋框輸入 `tag:<name>` → 只列出該書籤；點圓點 → 搜尋框填入 `tag:<name>` 並篩選。
- 迴歸：`npm run test:ci`（含 main 已修好的 happy_path 測試）不破壞；`test:full` 全綠。

## 後續備忘
- #5 Drive 同步的 OAuth live 測試（待 owner）。
- tag: 搜尋若未來要支援「OR / 排除(-tag:)」可再擴充 parseSearchQuery。
