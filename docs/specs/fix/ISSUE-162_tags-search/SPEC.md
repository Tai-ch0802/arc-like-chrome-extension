# [Fix/T1] Tags 與搜尋修正（#162 WP4：B1~B7）

## 背景與問題

- **B1 [High]**：`tagManager` 把 tags/bookmarkTags 整表載入 module 狀態、每次變更整表寫回，卻是**全專案唯一沒訂 `storage.onChanged` 的可變資料集** —— 多視窗下，視窗 B 的任一 tag 操作會用陳舊的表覆寫掉視窗 A 剛建立的 tag（last-write-wins 互滅，靜默且不可復原）。
- **B2 [Med]**：`tag:` regex 未錨定字界 —— `montag:9`、貼上含 `hashtag:` 的 URL 都被解析成 tag 查詢 → 非書籤區段全部隱藏 + 零結果，全面板空白且無解釋。
- **B3 [Med]**：刪除 tag 只移除對話框列，沒發 `refreshBookmarksRequired`（edit 路徑有）→ 書籤列殘留死 dot，點擊進入 `tag:已刪名稱` 死路。
- **B4 [Med]**：tag 名允許 `"` → dot-click 產生的 `tag:"..."` token 無法 round-trip。
- **B5 [Low]**：全形冒號 `tag：` 不被解析 —— zh-TW IME 預設輸出全形標點，主場痛點。
- **B6 [Low]**：暖啟動時 `pruneOrphanedBookmarkTags` 拿「上個 session 的 cache 快照」立即執行，與背景 rebuild 競態 —— 陳舊快照缺少仍存在的書籤時會**誤刪活的 tag 綁定**且無法復原。
- **B7 [Low]**：8px 純色 dot 無描邊，yellow on light 1.93:1、grey on dark ~2.7:1，低於 WCAG 1.4.11 的 3:1。

## 方案

1. **B1**：`initTags()` 安裝一次性 `storage.onChanged` 訂閱（比照 readingList summaryStore 模式）：reload in-memory 兩表；內容真的變了才 dispatch `refreshBookmarksRequired`（JSON 比對 —— 寫入端自己的 echo 內容相同，自動跳過、不雙重 render）。
2. **B2/B5**：regex 改 `(^|\s)tag[:：]"..."|(^|\s)tag[:：]\S+`（字界錨定 + 全形冒號）。
3. **B3**：刪除路徑補發 `refreshBookmarksRequired`。
4. **B4**：抽出純函式 `normalizeTagName`（trim + 40 字 + 剝 `"`），create/update 共用。
5. **B6**：prune 一律等 cache 可信：冷啟動（已 await build）直接跑；暖啟動掛 `bookmarkCacheReady` once listener（新增 `pendingWarmCacheRebuild` 旗標判別）。rebuild 失敗 → 本 session 跳過 prune（安全方向）。
6. **B7**：dot 9px + 1px 主題感知描邊（`color-mix` 寫在消費端規則，跟著 body 主題解析）。

排除的替代方案：tags 改 per-id keys（如 workspace v2）—— tags 資料量極小（幾 KB）、寫入頻率低，onChanged reload 已消除互滅；per-id 化的 migration 成本不成比例。

## 影響面

- `modules/bookmark/tagManager.js`（訂閱、normalizeTagName）
- `modules/utils/searchUtils.js`（parseSearchQuery regex）
- `modules/bookmark/bookmarkToolsUI.js`（刪除路徑 refresh）
- `sidepanel.js`（prune 時機 + 旗標）
- `sidepanel.css`（dot 描邊）
- 無 storage schema 變更（資料形狀不變）、無 manifest / i18n 變更

## Test Impact

- `searchUtils.test.mjs`：新增錨定（montag / hashtag-URL）、全形冒號、錨定後正常 token 案例。
- `tagPicker.test.mjs` 不受影響；新增 `normalizeTagName` 案例（附在 searchUtils 測試檔或獨立）。
- E2E：`happy_path_` 全套需綠（含 tag 相關 E2E）。

## 驗收條件

- [ ] `parseSearchQuery('montag:9')` → keywords=['montag:9']、tags=[]；URL 含 `hashtag:` 不再誤判。
- [ ] `parseSearchQuery('tag：工作')` → tags=['工作']。
- [ ] `normalizeTagName('say "hi"')` 無引號。
- [ ] 刪除 tag 後書籤列 dot 即時消失（refreshBookmarksRequired 由刪除路徑發出）。
- [ ] 他窗 tag 變更觸發本窗 reload + 重繪；本窗自己的寫入不雙重 render（JSON 相同跳過）。
- [ ] 暖啟動 prune 不在 bookmarkCacheReady 前執行。
- [ ] unit + happy_path E2E 全綠。
