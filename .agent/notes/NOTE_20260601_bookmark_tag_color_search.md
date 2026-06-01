# NOTE 2026-06-01 — 書籤標籤強化：顏色 + tag: 搜尋

## 背景
批 A 的書籤標籤有兩個缺口（管理 UI 無法設定顏色；搜尋無法依標籤篩選），使其形同半成品。本次補齊。分支 `feat/bookmark-tag-color-and-search`（從合併後的 main，含 A–E）。

spec：`docs/superpowers/specs/2026-06-01-bookmark-tag-color-and-search-design.md`；plan：`docs/superpowers/plans/2026-06-01-bookmark-tag-color-and-search.md`。

## 做了什麼
- **純函式（TDD）** `modules/utils/searchUtils.js`：`parseSearchQuery(query)`→`{keywords,tags}`（抽 `tag:單詞` 與 `tag:"含空白"`、tag 名小寫）、`bookmarkMatchesTags(have, required)`（AND、大小寫不敏感、精確名稱）。10 個新單元測試。
- **顏色** `modules/modalManager.js` 新增 `showTagDialog({title,defaultName,defaultColor})`（仿 `showCreateGroupDialog`：名稱 input + 8 色票 + 鍵盤/focus trap）；`bookmarkToolsUI` 建立/編輯標籤改用它（編輯後 dispatch `refreshBookmarksRequired` 讓書籤列圓點換色）。`.tag-color-swatch[data-color]` 色值與 `.bm-tools__tag-chip` 一致。
- **搜尋** `modules/searchManager.js`：`handleSearch` 用 `parseSearchQuery`；`filterBookmarks(keywords,regexes,tags)` 以 `kwOk && tagOk`（tagOk 用 `getTagsForBookmark`）篩選；空-both 才還原完整視圖；分頁/閱讀清單只吃 keywords（tag token 已分離，不受影響）。
- **點圓點篩選** `modules/ui/bookmarkRenderer.js`：圓點加 `dataset.tagName`；委派 click 最前攔截 → 設 `#search-box` 值為 `tag:<name>`（含空白則加引號）+ dispatch input（觸發既有 debounced 搜尋）+ stopPropagation（不開書籤）。`.bookmark-tag-dot{cursor:pointer}`。
- **i18n** `bmToolsEditTag` × 14 語系。

## 驗證 / 狀態
- 單元 228 綠（含 searchUtils 新測試）；`test:ci` 49 綠（含新 E2E `happy_path_bookmark_tag_color_search`）；`test:full` 102 passed / 0 failed；`make`/`make release` OK。
- 整體 code review：ready to merge，無 Critical/Important。
- 已知 Minor（非阻斷）：建立對話框標題沿用 `bmToolsCreateTagPrompt`（「New tag name」）略不順；標籤名含字面雙引號不完美 round-trip（spec 已列非目標）；tag-only 查詢不篩分頁/閱讀清單（符合意圖）。

## 後續
- 5 commit（`269653b`…`0fffd38`）；本批與 Drive 無關、無敏感權限，可獨立 merge。
- 未了：批 E Drive 同步的 OAuth live 測試（待 owner，與本批無關）。
