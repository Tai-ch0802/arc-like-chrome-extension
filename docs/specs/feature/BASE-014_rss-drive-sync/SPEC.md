# BASE-014 — RSS 去重修正 + Google Drive 跨裝置同步

- **分級**：T2（改 storage schema、擴大 OAuth 上傳範圍、跨裝置協定、遷移、隱私揭露）
- **狀態**：實作中（單一 PR）
- **關聯**：延伸 ISSUE-49（Reading List / RSS）與 Drive 同步基建（`modules/sync/*`）

## 1. 問題與根因（Bug）

**症狀**：RSS 訂閱項目開啟後以 `rssFetchedHashes`（SHA-256(URL)）去重，但使用者「有時候」看到重複項目。

**根因**：`modules/rssManager.js` 的 `fetchedHashes` 是模組層級 `Set`，Service Worker / side panel / options 各持一份。`saveFetchedHashes()` **盲目整包覆寫** `storage.local`，且無 `storage.onChanged` 監聽。長開的 side panel 持陳舊快照，在使用者刪除/標記（`readingListManager` → `markAsFetched`）時整包覆寫，清掉 SW 期間新增的 hash；SW 冷重載後從縮水 storage 重載 → 文章被判為新項目重抓。四條件（panel 長開 + SW 抓新 + 刪除動作 + SW 冷重載）交集吻合「有時候」。與 workspace `mutateWindowMap` 全表覆寫事故同族。

## 2. 產品決策（已與需求方確認）

1. 去重 hash **與** RSS 訂閱清單都完整搬到 Google Drive appdata，Drive 為跨裝置**唯一真實來源**；本地保留工作副本。
2. 全部做在同一分支/PR。
3. 登入引導：options 設定頁提示 + sidepanel 一次性 toast。

**能力界定（誠實）**：hash 同步用於「降低跨裝置重複 + 修 SW 冷重載自我重複」，**不保證**跨裝置 reading list 完全去重（reading list 實體是 `chrome.readingList`，不在同步範圍）。

## 3. 設計

### 3.1 儲存
- 訂閱工作副本：`storage.sync` → **`storage.local`**（避免 Chrome 原生 sync 與 Drive 雙套複寫造成刪除-復活震盪）。pipe format 尾端新增 `updatedAt`（向後相容，缺欄位解析為 0）。
- 去重 hash / tombstone：`storage.local`（`rssFetchedHashes` / `rssTombstones`）。
- Drive：單一 appdata 檔 **`rss-sync.json`** = `{schema, subscriptions[], tombstones{id:deletedAtMs}, hashes[]}`。被 workspace `pullRemote` 的 `/^ws_.../` 過濾安全略過。

### 3.2 純函式合併（`modules/rss/rssSyncLogic.js`，含 unit test）
`mergeRssState(local, remote, {now})`：hashes = union 後 cap；subscriptions = 依 id 合併（衝突取 `updatedAt` 大者、`lastFetched` 取 max）；tombstone `deletedAt ≥ updatedAt` 排除該 id；tombstones union 取 max、GC 180 天。**對固定 `now` 滿足交換律 + 冪等**（收斂前提）。`nextTimestamp` 為 Lamport-lite 單調時戳。

### 3.3 觸發（全在 SW，`background.js`）
- **pull**：`runSyncOnce()` 尾端 piggyback `rssSyncOnce()`（自包 try/catch）。
- **push**：`storage.onChanged` 偵測 local RSS key 變更 → debounce `rssSyncFlush` alarm → `rssSyncOnce()`。dispatcher **明確分支** `rssSyncFlush`（否則被 `handleRssAlarm` 的 `rss_fetch_` 前綴 early-return 吞掉）。
- **`rssSyncOnce()`**：single-flight（`rssSyncChain`）；read `rss-sync.json` → 讀 local → merge → **no-op write guard**（僅在與 local / remote 不同時才寫）→ 收斂 ≤2 cycle，取代 `engineWriteEcho`。
- **alarm 只動 delta**：`importMergedRssState` 依 id diff 只 (re)setup 真正新增/enable/interval 變動的 alarm，避免整包重設造成兩裝置每分鐘 ping-pong 抓取。

### 3.4 遷移
`rssMigratedFromSync`（local）一次性旗標：首次 `loadSubscriptions` 時，local 無訂閱才自 sync 做種。**不刪 sync key**（刪除經原生 sync 傳播會 wipe 未升級裝置）、**不 dual-write 回 sync**。Drive 有資料時 SW 的 rssSyncOnce 會自然「Drive 優先」import（含建 alarm）；seeded 訂閱 `updatedAt=0`，任何真實編輯或 Drive tombstone 皆勝出。

## 4. 風險與緩解（對抗式壓測後）
| # | 風險 | 緩解 |
|---|---|---|
| A | hash union 觸 cap FIFO 破壞冪等 → 兩裝置互灌 + flush 風暴 | `MAX_STORED_HASHES` 500→**5000**（訂閱一致→同批 feed→同 hash→穩態不觸頂；local ~10MB 免 `unlimitedStorage`） |
| B | `saveSubscriptions` 同族盲寫；SW `fetchNow` 整包覆寫 clobber options 編輯 | SW lastFetched 改欄位級序列化 `persistLastFetched` |
| C | `rssSyncFlush` 被 dispatcher 誤丟 → push 靜默失效 | dispatcher 明確分支 |
| D | lastFetched>0 但 hash 未同步 → 全 re-add | subs+hashes 同一 `rss-sync.json`、同一次 merge 原子成套（**絕不拆檔**） |
| E | GC 後超長離線裝置回灌；遷移重複做種 | GC 180 天；`rssMigratedFromSync` 一次性旗標 |
| F | pull/flush 的 rssSyncOnce 同機交錯 lost-update | `rssSyncOnce` single-flight |
| G | clock skew 下 delete/edit LWW 誤判 | Lamport-lite 單調 `updatedAt`；文件化為可接受殘留 |

## 5. 隱私揭露（trust boundary）
上傳 RSS feed URL + 標題 + 文章 URL 的 SHA-256 至 Drive appdata，屬新增的離裝置資料。已更新 `_locales`（`syncConnectDisclosureMessage` / `syncAccountDesc` / `syncPrivacyNote`）× 14、`web/locales`（`privacy_s2_li2` / `privacy_s2_1_desc` / `privacy_s2_1_li2` / `guide_*`）× 14、`web/privacy.html`、`web/guide.html`、`PRIVACY_POLICY.md`。manifest scope **無需變更**（`drive.appdata` 已宣告）。

## 6. 測試
- `rssSyncLogic.test.mjs`：union / id-merge / updatedAt LWW / lastFetched max / tombstone 排除與復活 / GC / **交換律 + 冪等（含觸頂 cap）** / Lamport-lite；`mergeHashesForWrite` 去重 regression（舊快照不再覆蓋）。
- 手動：交錯操作驗證不重複、跨裝置同步、未登入照常、onboarding toast 一次。
- 跨裝置真 OAuth E2E 成本高又 flaky，不做。
