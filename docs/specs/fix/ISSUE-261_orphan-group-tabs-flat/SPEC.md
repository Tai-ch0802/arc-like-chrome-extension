# ISSUE-261：群組未知的分頁改平鋪顯示（Dia 分組分頁消失）

> 層級：T1。對應 issue：#261。承接 ISSUE-257（Dia 相容）之後使用者在 Dia 正式 profile 的回報。

## 背景與問題

v1.21.0 在 Dia 1.54.x 可用後，使用者發現側欄「分頁」區與 Dia 自己的 sidebar 對不起來：主視窗 24 個分頁只畫出 12 個，「其他視窗」區也少。

使用者在 Dia 正式 profile 的 service worker console 與側欄 DevTools 各跑一次 dump（`chrome.tabs.query({})`、`chrome.windows.getAll({populate:true})`、`chrome.tabGroups.query({})`、`Object.keys(tab)`），結果一致：

- Dia 的 Tab Groups 會在 `chrome.tabs.Tab` 上回報 `groupId > 0`（實測 2、3、4、5 四組共 12 個分頁），分組與未分組分頁在**同一個 `windowId`**。
- **`chrome.tabGroups.query({})` 在兩個 context 都回空陣列**。`tabGroups.get / update` 因此不可依賴；群組的標題、顏色、摺疊狀態都拿不到。
- 分組分頁的 `index` **不連續**（group 2 在 index 0–2、4–6，中間 index 3 是未分組分頁）。Chrome 保證同群組相鄰，Dia 不保證。
- 分頁物件是標準 Chromium 156 的 22 個欄位，**沒有 Favorites 標記**；Dia 的 Favorites 是 `pinned:false`、`groupId:-1` 的普通分頁。

**根因**：`modules/ui/tabRenderer.js` 與 `modules/ui/otherWindowRenderer.js` 的渲染迴圈遇到「分頁帶 `groupId`，但 `groups` 查詢結果裡沒有該群組」時直接 `continue`，整批分頁不渲染。這行早於 ISSUE-257（來自 366b9d7 的 uiManager 拆分），在 Chrome 上也會出現：群組在 `tabGroups.query` 與 `tabs.query` 兩次查詢之間建立時，該幀的分頁會閃掉，直到下一次 render。

## 方案

群組未知的分頁改成**平鋪**：主側欄畫成頂層列、其他視窗畫成資料夾內的列，位置照 `tabs.query` 的 index 順序；已知群組的渲染路徑完全不變。

細節：

- 兩個 renderer 共用同一條規則：`displayGroupId = (tab.groupId > 0 && groupsMap.has(tab.groupId)) ? tab.groupId : -1`。
- 平鋪列**不掛 `dataset.groupId`**。`dragDropManager`、`searchManager`、`tab/tabListeners` 都從 `dataset.groupId` 推論「這列屬於一個有標頭的真群組」；掛上去會讓拖曳位置計算與搜尋計數指向不存在的標頭。`tabRenderer` 的 `createTabElement` / `updateTabElement` 與 `otherWindowRenderer` 的 `createOtherWindowTabElement` 因此多收一個 `displayGroupId`（預設 `tab.groupId`，對外行為不變）。
- `tabsCache` 仍存完整的 tab 物件（含真實 `groupId`），右鍵選單等既有邏輯不受影響。
- 同一列在「群組未知 → 已知 → 又未知」之間切換時沿用快取元素，`updateTabElement` 負責加／刪 `dataset.groupId` 並由 `reconcileDOM` 搬到正確容器（Chrome race 的下一幀會自動歸位）。

排除的替代方案：

- **合成無標題群組標頭**：Dia 給不出 title / color，四個標頭長得一樣；`tabGroups.update` 失敗，摺疊狀態只能存側欄本地，且會讓拖曳到標頭的邏輯呼叫必失敗的 `getTabsInGroup / moveTabGroup`。保留為日後選項。
- **在 apiManager 層把未知群組的 `groupId` 改寫成 -1**：會污染 `tabsCache` 與所有讀 `tab.groupId` 的模組（路由、生命週期豁免判斷），把「這個分頁其實在 Dia 群組裡」的事實抹掉。

## 影響面

- `modules/ui/tabRenderer.js`：`renderTabsAndGroups` 迴圈、`getOrCreateTabElement`、`createTabElement` / `updateTabElement` 的 `displayGroupId` 參數。
- `modules/ui/otherWindowRenderer.js`：`renderOtherWindowsSection` 迴圈、`createOtherWindowTabElement` 的 `displayGroupId` 參數。
- 不動 storage、manifest、跨 context 協定；無新模組（Makefile / GEMINI.md 不需改）。
- 連動風險：拖曳一個平鋪列到已知群組標頭上仍走原本的「加入群組」路徑；在 Dia 上 `tabs.group` 會被 ISSUE-257 的能力旗標短路成 no-op，與現況一致。

## Test Impact

- 新增 unit：`usecase_tests/unit_tests/orphanGroupTabs.test.mjs`（jsdom，動態 import 兩個 renderer）。案例：未知群組平鋪且不掛 `dataset.groupId`、index 不連續、已知群組路徑不變（Chrome 回歸守門）、已知／未知混合、同一列在未知↔已知之間切換沿用快取元素、其他視窗資料夾同規則。**未修前 4 個案例 fail、2 個 Chrome 路徑案例 pass**（已驗證）。
- 既有 Chrome E2E（群組渲染相關）作為回歸：`happy_path_tab_group_toggle`、`add_to_group`、`group_edge_cases`、`search_group_expand`、`happy_path_sidepanel`、`dia_capability_degrade`。
- Dia 真機驗證無法自動化（隔離 profile 卡 Atlassian 登入牆、`tabs.group` 無法建群組）：由使用者在正式 profile 以 dev build 目視確認 24 個分頁全部出現。

驗證指令：

```bash
npm run test:unit
npx jest usecase_tests/puppeteer_tests/happy_path_tab_group_toggle.test.js usecase_tests/puppeteer_tests/add_to_group.test.js usecase_tests/puppeteer_tests/group_edge_cases.test.js usecase_tests/puppeteer_tests/search_group_expand.test.js usecase_tests/puppeteer_tests/happy_path_sidepanel.test.js usecase_tests/puppeteer_tests/dia_capability_degrade.test.js
```

## 驗收條件

- [x] `groups` 為空而分頁帶 `groupId` 時，主側欄與其他視窗區都畫出全部分頁，順序依 index，列上無 `dataset.groupId`，無群組標頭。
- [x] `groups` 含該群組時，渲染結果與修改前完全相同（標頭、內容容器、列上 `dataset.groupId`）。
- [x] 同一分頁在群組未知→已知→未知之間切換時，沿用同一個 DOM 元素並落在正確容器。
- [x] 上述 Chrome E2E 全綠。
- [ ] 使用者在 Dia 正式 profile 確認分組分頁出現（平鋪）。
