# ISSUE-263：Dia 釘選群組的合成標頭與標題快取

> 層級：T1。對應 issue：#263。承接 #261 / #262（群組未知的分頁改平鋪）之後的真機回報。
> 分支疊在 `fix/orphan-group-tabs-flat`（#262）之上。

## 背景與問題

#262 讓 Dia 上所有分頁都出現，但使用者回報「pinned 後的群組看不出階層」：Dia 釘選群組的成員被平鋪成一般列，和 Dia 自己的側欄對不起來。

使用者在正式 profile（Dia 1.54.x / Chromium 156）跑了兩輪探測（`tabGroups.get / query`、`tabs.query({groupId})`、快照→動作→diff、事件監聽），定案：

| 事實 | 證據 |
|---|---|
| **未 pin 的群組是正常的 Chromium TabGroup** | `get` 回 title / color / collapsed / windowId；`query({})` 回它；新建群組（F）預設如此 |
| **pin 會把群組從 Chromium 模型移除、分頁保留 `groupId`** | B：pin 後 `get` 丟 `No group with specified id`、`query({})` 少它，tab diff 為空 |
| **unpin 以同一個 id 重新註冊並帶回 Dia 的 title / color** | C：兩個群組都以原 id 回來，標題與顏色和 pin 前一致 |
| **Dia 不發任何 `tabGroups.*` 事件，也不發帶 `groupId` 的 `tabs.onUpdated`** | 六個動作零事件，只有 `frozen` 翻轉 |
| Favorites（⌘⇧D）無法辨識 | 唯一效果是分頁 `groupId` 變 -1 |
| 書籤不是即時鏡射；`tabs.db` 加密 | 零筆 `bookmarks.*` 事件；檔頭非 SQLite magic |

推論：**釘選群組 = 分頁 `groupId > 0` 且群組不在 `tabGroups.query` 結果裡**，正是 #262 的 unknown-group 分支。標題與顏色沒有即時來源，只能在群組還沒 pin 的期間先記下來；同一 session 內 id 跨 pin / unpin 穩定，跨重啟 id 會重編（啟動時依序配 2、3、4…）。

## 方案

1. **合成群組取代平鋪**：兩個 renderer 對群組未知的分頁改畫「標頭 + 內容區」，成員依 `tabs.query` 的 index 順序；標頭加 `is-synthetic` class 與釘選圖示，不掛 `dataset.groupId`（改掛 `dataset.syntheticGroupId`），列也同樣。
2. **`modules/groupMetaCache.js`**（新模組，DI 工廠 + 預設單例）：
   - `observe(groups, tabs)`：每次 `updateTabList` **畫完之後、不 await** 把查得到的群組記成 `id → { title, color, urls }` 寫進 `storage.session`（key `groupMetaSession`），同時以成員 URL 指紋存進 `storage.local`（key `groupMetaByFingerprint`，陣列、上限 100 筆、依 `updatedAt` 淘汰）。只有內容變了才寫；`storage.local` 的寫入以 2 秒 trailing 合併（分組分頁每次導航都會改指紋）。**Google Chrome 不開指紋層**（`persistFingerprints: !isGoogleChrome`）：Chrome 永遠回報群組，這層在 Chrome 只是純粹的儲存開銷。
   - `resolve(groupId, memberTabs)`：先以 id 查 session（同 session 內 pin 後命中），再以成員 URL 的 Jaccard ≥ 0.5 查指紋（重啟後 id 重編仍能找回），都沒有回 `null`。
   - `isCollapsed / setCollapsed`：合成群組的摺疊狀態存 `storage.session`（key `syntheticGroupCollapsed`），不呼叫 `tabGroups.update`。
   - URL 正規化：`origin + pathname`（去 query / hash），非 http(s) 原樣。
3. **退路標題**：沒有快取時，成員共同網域（去 `www.`）；沒有共同網域則 i18n `pinnedGroupFallbackTitle`（「釘選群組」）；標頭 tooltip 改用 `pinnedGroupFallbackHint` 提示「取消釘選再釘選一次即可顯示名稱」。
4. **守門**：
   - `dragDropManager`：合成標頭不可拖（`.tab-group-header:not(.is-synthetic)`）、合成內容區不建 Sortable（`.tab-group-content:not(.is-synthetic)`），`getNextDraggable` 略過合成標頭但會進入其內容區找下一個分頁；`handleDragAdd` 對沒有 `dataset.groupId` 的標頭直接返回。**代價**：合成群組裡的列完全不能拖（含拖到書籤區建書籤，#262 平鋪時可以）；列上的「加入書籤」按鈕仍可用。
   - `tab/tabListeners`：點擊合成標頭只切換 DOM 並寫本地摺疊狀態，不呼叫 `api.updateTabGroup`。
   - `searchManager`：主列表照 `tabsCache` 的真實 `groupId` 計數（不變）；其他視窗與 DOM fallback 改讀 `dataset.groupId ?? dataset.syntheticGroupId`。合成標頭登記在既有的 header cache（鍵為真實 groupId），搜尋展開／隱藏與 tag 查詢的整批隱藏不需另寫。
5. **Chrome 不受影響**：`tabGroups.query` 在 Chrome 永遠可用，只有群組在兩次查詢之間建立的那一幀會短暫畫出合成標頭，下一幀換成真標頭（元素沿用快取）。

排除的替代方案：

- **只平鋪（維持 #262）**：使用者明確要階層。
- **以 `tabGroups.get` 失敗字串判斷**：錯誤字串跨版本漂移（#257 教訓），「不在 query 結果」已足夠且零 API 呼叫。
- **書籤鏡射當標題來源**：實測零事件，不是即時鏡射。
- **只用 `storage.session` 快取**：Dia 重啟後 id 重編，所有釘選群組都會退回退路標題；指紋快取讓標題跨重啟存活。
- **在 apiManager 改寫 `groupId`**：#261 已排除（污染 `tabsCache` 與路由／生命週期判斷）。

## 影響面

- 新模組 `modules/groupMetaCache.js`（Makefile 的 `modules` 整目錄打包，不需改；GEMINI.md `key_files` 補一筆）。
- `modules/ui/tabRenderer.js`、`modules/ui/otherWindowRenderer.js`：unknown-group 分支改合成群組；`updateTabElement` 維護 `dataset.syntheticGroupId`。
- `modules/ui/tab/tabListeners.js`：合成標頭的摺疊走本地狀態。
- `modules/dragDropManager.js`、`modules/searchManager.js`：如上守門。
- `sidepanel.js`：`updateTabList` 先 `observe` 再 render；初始化時 `load()`。
- `modules/icons.js`：新增 `keep`（釘選）圖示；`sidepanel.css`：`.is-synthetic` 樣式。
- `_locales/*/messages.json`（14 語）：`pinnedGroupFallbackTitle`、`pinnedGroupFallbackHint`。
- storage：新增 `storage.session` 的 `groupMetaSession`、`syntheticGroupCollapsed` 與 `storage.local` 的 `groupMetaByFingerprint`。皆為新 key、無既有 schema 變更、無 migration；`groupMetaByFingerprint` 不是 `pref_*`，不會被 Drive 設定同步撿走（`prefsSyncLogic` 走 allowlist）。
- 不動 manifest、跨 context 協定。
- 連動風險：Dia 不發群組事件，pin / unpin 後側欄要等下一個 `tabs.*` 事件（通常是點擊帶來的 `frozen` 翻轉）才重繪；本 PR 不加輪詢。

## Test Impact

- 新增 unit `usecase_tests/unit_tests/groupMetaCache.test.mjs`（node）：observe 後同 id 命中、session 清空後以指紋命中、低於門檻不命中、空 title 不當退路、上限淘汰、只在變更時寫入、摺疊狀態讀寫、storage 缺席降級為記憶體。
- 改寫 `usecase_tests/unit_tests/orphanGroupTabs.test.mjs` → `syntheticGroupHeaders.test.mjs`（jsdom，沿用 `sidePanelDomFixture.js`）：未知群組畫合成標頭與內容區、成員依 index、標頭／列無 `dataset.groupId` 而有 `dataset.syntheticGroupId`、標題來自 resolve／共同網域／i18n 退路、摺疊狀態套用、已知群組路徑不變、已知／未知混合、同一列在合成↔真群組之間切換沿用元素、其他視窗同規則。**實作前 RED**。
- 既有 Chrome E2E 回歸：`happy_path_tab_group_toggle`、`add_to_group`、`group_edge_cases`、`search_group_expand`、`tab_dragging`、`dia_capability_degrade`、`happy_path_sidepanel_*`。
- Dia 真機（無法自動化）：使用者以 dev build 確認釘選群組有標頭；unpin 再 pin 一次後標題出現；重啟 Dia 後標題仍在。

```bash
npm run test:unit
npx jest usecase_tests/puppeteer_tests/happy_path_tab_group_toggle.test.js usecase_tests/puppeteer_tests/add_to_group.test.js usecase_tests/puppeteer_tests/group_edge_cases.test.js usecase_tests/puppeteer_tests/search_group_expand.test.js usecase_tests/puppeteer_tests/tab_dragging.test.js usecase_tests/puppeteer_tests/dia_capability_degrade.test.js
make && make release
```

## 驗收條件

- [x] `groups` 不含某群組而分頁帶該 `groupId` 時，主側欄與其他視窗都畫出「合成標頭 + 成員」，成員依 index，標頭與列無 `dataset.groupId`。（unit：`syntheticGroupHeaders.test.mjs`）
- [x] 同一 session 內群組被 pin 後，標頭顯示 pin 前快取的標題與顏色；session 快取缺席時以成員 URL 指紋找回；都沒有時顯示共同網域或「釘選群組」。（unit：`groupMetaCache.test.mjs` + renderer 測試；Dia 真機見最後一項）
- [x] 合成標頭可摺疊，狀態存本地，不呼叫 `tabGroups.update`；拖放不會對合成群組呼叫群組 API。（unit 驗證點擊路徑；拖放以選擇器排除，`tab_dragging` E2E 綠）
- [x] `groups` 含該群組時渲染結果與 #262 相同；上述 Chrome E2E 全綠。
- [ ] 使用者在 Dia 正式 profile 確認釘選群組有階層與標題（unpin 再 pin 一次後標題出現；重啟 Dia 後標題仍在）。
