# BASE-017：快訊區塊 UX 強化（快速清除／搜尋整合／固定高度捲動）

> 分級：**T1**（單檔 SPEC，隨 PR 一起審）
> 狀態：實作中｜2026-07-23
> 前置：BASE-016 newswire N1–N4（已合併 #189/#191）

## 背景與需求（使用者提出）

1. 側邊欄快訊區塊新增**快速清除**按鈕。
2. 側邊欄**搜尋 bar 支援快訊過濾**（與分頁/書籤/閱讀清單一致）。
3. 快訊區塊**固定高度**（約 30 則的高度），超過改由**內部 scroll bar** 上下找舊訊息。

## 方案

### 1. 快速清除

- header 新增 `#newswire-clear-btn`（**base `header-action-btn` 即 danger 紅**，破壞性操作語意正確；純文字按鈕沿 `clear-all-read-btn` 先例）。
- 顯示條件跟「列表有無內容」走、**不跟來源開關**——來源全關後殘留的舊訊息也要能清。
- 協定：新增 `newswire:clear` message → SW `eventBuffer.clear()`（清空＋立即落地）→ 廣播 `newswire:cleared` → 所有開啟中的 sidepanel 各自清空列表/pending/未讀（跨視窗一致）。
- **dedupe set 刻意保留**：Tree 下次重連的 history replay 不會把剛清掉的舊訊息復活。
- 一鍵清除、不做確認對話框：快訊為短暫流水非使用者資料（ponytail）。

### 2. 搜尋整合

- `searchManager` 新增 `filterNewswire(keywords)`（`filterReadingList` 的精簡版）：比對 `dataset.title`＋`dataset.source`（renderer 補設 dataset），`.hidden` toggle，計數併入 `searchResultUpdated` 的 `tabCount` 聚合。
- `hideNonBookmarkSections()`（tag: 查詢）同步隱藏快訊項目。
- **不做 innerHTML 高亮**：快訊標題為外部不可信內容，維持該區塊 textContent-only 的安全紀律（閱讀清單的高亮走 `highlightText`+innerHTML，快訊刻意不跟）。

### 3. 固定高度＋內部捲動

- CSS：`#newswire-list { max-height: calc(30 * (16px + 2 * var(--list-row-py))); overflow-y: auto; overscroll-behavior: contain; }`——30 列高度**隨密度設定縮放**。
- **未讀判定改寫**：原本用 IntersectionObserver 觀察列表上方的 sentinel；列表改內部捲動後 sentinel 恆在視野內、判定失真。改為 `list.scrollTop <= 4px` 即「在頂部」——新事件到達時在頂部＋視窗聚焦→即讀，否則未讀累加；捲回頂部時歸零。sentinel 元素移除。
- **捲動位置保持**：使用者往下看舊訊息時新事件 prepend，以插入前後 `scrollHeight` 差補償 `scrollTop`，內容不跳動。

## 影響面

| 檔案 | 變更 |
|---|---|
| `sidepanel.html` | +清除鈕；−sentinel div |
| `modules/ui/newswireRenderer.js` | 清除接線與 `newswire:cleared` 處理、scroll 式未讀判定、prepend 捲動補償、dataset.title/source |
| `modules/newswire/feedManager.js` | `newswire:clear` 分支（buffer.clear＋lastSeen 重設＋廣播） |
| `modules/newswire/eventBuffer.js` | +`clear()` |
| `modules/searchManager.js` | +`filterNewswire`、計數聚合、`hideNonBookmarkSections` 補快訊 |
| `sidepanel.css` | `#newswire-list` 高度/捲動 |
| `_locales` ×14 | +`newswireClearBtn`（394→395） |

跨 context 協定新增僅 `newswire:clear`／`newswire:cleared` 一對（沿既有 `newswire:*` namespace 慣例；語意單純、無 storage schema 變更，維持 T1）。

## Test Impact

- unit：`newswireEventBuffer.test.mjs` +clear 案例（清空、立即落地、取消 pending timer）。
- E2E `happy_path_newswire.test.js` +3：搜尋過濾與復原、固定高度樣式、清除鈕 SW roundtrip（列表清空＋storage 落地＋按鈕隨之隱藏）。
- 既有測試：未讀/暫停行為語意不變（判定來源從 sentinel 改 scrollTop，unit 未覆蓋該 DOM 邏輯、E2E 不受影響）。

## 驗收條件

- [ ] 清除鈕在有內容時出現，一鍵清空所有 sidepanel 的快訊列表與 ring buffer；來源全關時仍可清。
- [ ] 搜尋框輸入關鍵字時快訊列表同步過濾（標題/來源），計數併入結果總數；`tag:` 查詢時快訊整批隱藏；清除搜尋復原。
- [ ] 列表高度上限約 30 列並隨密度縮放；超過出現內部捲軸；往下捲時新訊息不造成內容跳動；捲回頂部未讀歸零。
- [ ] `npm run test:unit`、`npm run test:ci` 全綠；`make` 打包成功。
