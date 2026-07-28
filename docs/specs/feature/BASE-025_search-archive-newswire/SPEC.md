# BASE-025 — 搜尋欄擴及封存區與快訊區（過濾＋反白）

> T1 輕量 SPEC（分級理由：不動 storage schema／manifest／跨 context 協定、無資料遺失風險；
> 是把既有互動延伸到兩個既有區塊）。隨 PR 一起審。

## 背景與問題

sidebar 搜尋欄本質是 filter：解析多關鍵字（AND）＋ `tag:` 語法，對命中項過濾顯示並以
`<mark>` 反白匹配片段，同時比對標題與 URL 網域。現況覆蓋盤點（實地精讀 `searchManager.js` 後）：

| 區塊 | 過濾 | 反白 | URL/網域比對 | tag: 查詢時隱藏 |
|---|---|---|---|---|
| tabs / 其他視窗 | ✅ | ✅ | ✅ | ✅ |
| bookmarks | ✅ | ✅ | ✅ | （目標區塊） |
| reading list | ✅ | ✅ | ✅ | ✅ |
| **newswire** | ✅（BASE-017） | ❌ | ❌（只比 title+source） | ✅ |
| **archive（BASE-024）** | ❌ | ❌ | ❌ | ❌ ←上線時漏接 |

兩個真 gap：**封存區完全未接**（含 tag: 查詢不隱藏的既存遺漏——搜尋時封存區顯示全部項目形同雜訊）；
**快訊有過濾但無反白也無網域比對**。

另外兩個整合難點（本案「比較難」的實質）：
1. **BASE-017 的反白禁令**：當時以「快訊標題為外部不可信內容，維持 textContent-only」為由不做反白。
   本案查證 `textUtils.highlightText`：**每一段**（匹配與非匹配區間）都先 `escapeHtml` 才組
   `<mark>`（textUtils.js:89-99），不可信內容走此路徑安全——閱讀清單標題同屬外部內容、
   已行之有年。禁令據此解除，並在 filterNewswire 註解記錄查證依據。
2. **搜尋中重繪洗掉過濾**：快訊即時事件 `prependEvents` 於頂部插入未過濾的新列；封存區在
   storage 變更時 `reconcileDOM` 重繪。兩者都會讓作用中的搜尋出現漏網項目。

## 方案

- **`filterArchive(keywords, regexes)`**（searchManager 新增）：比對 `dataset.title` ＋
  `extractDomain(dataset.url)`；反白 `.archive-item-title`；URL 命中（非標題命中）時附
  `.matched-domain`；snooze 項同列表一起過濾；計數併入 `searchResultUpdated`。
- **`filterNewswire` 升級**：補網域比對（renderer 補 `dataset.url`，值已經 normalizer 的
  `new URL` http/https 驗證）＋反白 `.newswire-item__title`。
- **共用 helper 抽取**：`highlightTitleEl` / `clearTitleEl` / `setMatchedDomainEl`
  （originalText dataset 模式），readingList／archive／newswire 共用；tab 路徑因 `_refs`
  快取結構特殊維持原樣。
- **`hideNonBookmarkSections` 補 archive**（修 BASE-024 上線遺漏）。
- **收合區塊的搜尋顯示——`search-reveal` 疊加 class**：`#newswire-list.collapsed.search-reveal`
  ／`#archive-list` 同，CSS override display。**刻意不走 readingList 的 remove-collapsed 作法**：
  newswire 的收合是 module 變數＋storage 狀態機，直接摘 class 會 desync（下次點 toggle 要按兩次）；
  疊加 class 不碰狀態機、清除搜尋自動恢復收合。readingList 既有行為不動（不擴scope）。
- **重繪同步——`sectionContentRerendered` DOM 事件**：archiveRenderer refresh 後、
  newswireRenderer `renderAll`／`prependEvents` 後 dispatch；searchManager 監聽（沿
  `bookmarkCacheReady` 慣例），查詢作用中才重跑 `handleSearch`，**debounce 250ms**——
  搜尋中的 handleSearch 含書籤樹重繪，快訊連續批次必須收斂為一次。

排除的替代方案：renderer 端自行感知搜尋狀態過濾新列（把查詢狀態耦合進兩個 renderer，
且反白邏輯要三份）；search-reveal 統一套用到 readingList（改既有語意，另案再議）。

## 影響面

- `modules/searchManager.js`：filterArchive 新增、filterNewswire 升級、三個共用 helper、
  hideNonBookmarkSections、rerender 監聽、計數。
- `modules/ui/archiveRenderer.js`：`dataset.title/url` ＋ refresh 後 dispatch。
- `modules/ui/newswireRenderer.js`：`dataset.url` ＋ renderAll/prependEvents 後 dispatch。
- `sidepanel.css`：search-reveal override 兩條。
- 無 storage／manifest／訊息協定變更；`<mark>` 樣式沿用既有 `.title-match`／`.url-match`。

## Test Impact

- 新 E2E `happy_path_search_archive_newswire.test.js`：
  - 封存：seed 項目 → 搜尋 → 非命中 hidden、命中含 `mark.title-match`、URL 命中顯示
    `.matched-domain`、收合時 search-reveal、清除搜尋還原（反白移除、恢復收合）。
  - 快訊：以第二個 extension 頁廣播 `{type:'newswire:events'}` 注入事件（`runtime.sendMessage`
    不自投遞的既有教訓）→ 搜尋過濾＋反白斷言；**搜尋作用中再 prepend 新事件 → 新列被即時
    過濾**（整合難點的回歸測試）。
  - `tag:` 查詢：封存與快訊整批隱藏（前者即 BASE-024 遺漏的迴歸）。
- 既有搜尋相關 E2E（happy_path_spotlight_search／search_group_expand 等）全套跑過確認不破壞。
- 驗證指令：`npm run test:unit`、`npx jest --testPathPatterns 'happy_path_search_archive_newswire'`、
  `npm run test:ci`、`make && make release`。

## 驗收條件

- [ ] 搜尋關鍵字時：封存與快訊只顯示標題／網域（快訊另含來源標籤）命中的項目，其餘 hidden。
- [ ] 命中片段以 `<mark>` 反白（封存＋快訊標題）；URL 命中時封存項顯示反白網域行。
- [ ] 收合中的封存／快訊區有命中時內容可見；清除搜尋後恢復原收合狀態且反白清除。
- [ ] `tag:` 查詢時封存與快訊整批隱藏。
- [ ] 搜尋作用中，快訊新事件與封存重繪產生的新列即時套用過濾。
- [ ] `searchResultUpdated` 計數含封存命中數。
- [ ] 全部既有測試綠（unit + happy-path 全套）。
