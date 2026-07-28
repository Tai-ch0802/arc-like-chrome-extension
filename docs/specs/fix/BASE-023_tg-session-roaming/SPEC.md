# SPEC — BASE-023 Telegram session 不漫遊 + 連線重建不重疊（AUTH_KEY_DUPLICATED 第二輪）

| 欄位 | 值 |
|---|---|
| 分級 | T1（不動 chrome.storage schema、不動 manifest 權限、不新增跨 context 協定；sync 變更為 payload 減法，配回歸測試） |
| 來源 | 使用者回報 AUTH_KEY_DUPLICATED 復發（offscreen console：`caused by channels.GetChannels` / `InvokeWithLayer`，前有 `Connection to pluto.web.telegram.org:443/w6 timed out after 10s`） |
| 前情 | `fix/BASE-022_tg-session-duplicate/`（PR #212：options 自建 client 併發、resident connecting 窗口，皆已修） |
| 嚴重度 | 高 — session 被伺服器作廢即需重新登入，快訊 tg 源實質不可用 |

## 背景與問題

PR #212 修掉單機內兩條已知併發路徑後，AUTH_KEY_DUPLICATED 仍復發。重新盤點後確認錯誤本身不是 lib 誤報：`JF` 即 bundle 內 minified 的 `AuthKeyDuplicatedError`（406），是 Telegram 伺服器偵測「同一 auth key 併發連線」後主動作廢 session 的保護機制；`caused by ...` 只是中槍時 in-flight 的 request。

盤點出三個殘存的併發來源（依影響排序）：

1. **session 跨裝置漫遊（設計層缺陷，本輪根因）**：BASE-018 讓 `keys.tg` 「搭既有 keys 同步便車」，`prefs.syncKeys=true` 時**整包 keys 含 `session` 進 Drive payload**。第二台裝置 pull 下來後雙方同時連線 = 不同 IP 併發同一 auth key，必被作廢且規律復發。Telegram 的模型是一個 session 綁一台裝置——session 與 apiKey 性質不同，本質上不可漫遊。
2. **重建拆除 fire-and-forget**：`tgOffscreenController.connect` 重建時舊 adapter 的 `disconnect()` 不等完成就建新 client；`tgAdapter.disconnect()` 也不 await `client.disconnect()`。每次重建（SW 冷啟、watchdog ping 逾時誤判、config 變更）都有數秒的同 key 雙連線窗口。另 teleproto `autoReconnect` 預設開啟，只 `disconnect()` 的殘骸可能自行重撥。
3. **粗粒度 rebuild 放大器**：`handleNewswireConfigChange` 對 `newswireConfig`/`newswireKeys`/`uiLanguage` 任何變更都全拆重建——改 mute 規則、改金十 key 都會拆掉 tg 常駐連線重撥，放大 2 的窗口出現頻率。

（單機網路飄移 + lib 自動重連的「伺服器視角兩個 IP」屬 GramJS 生態已知限制，gram-js/gramjs#189/#616/#195、Lonami/grammers#170，無法在應用層根除；2 的 destroy 優先已盡力縮小。）

## 方案

### a. session device-local（`newswireSyncLogic.js`）

新增 `stripTgSession(keys)` 純函式；`mergeNewswireState` 在 syncKeys ON 時改為：LWW 跑在**去 session 形**的兩側 → 遠端 legacy session 永不勝出落地本機；Drive payload 一律無 session，下次 write 自動 scrub 遠端殘留。

**本機持有 session 期間，整組 `keys.tg`（session＋apiId/apiHash）視為一套裝置本地憑證原樣保留**（PR #219 review 修正：初版只 re-attach session，會把 A 的 session 接到遠端漫遊來的 B apiId/apiHash 底下——從未驗證過的 cross-device 配對；遠端較新且無 tg 條目時更會留下「只剩 session」的殘缺組合誤報 needs-key）。`apiId`/`apiHash` 照常進 payload 漫遊，**只影響尚未登入（無 session）的裝置**——它們整包採用 merged 後自行登入取得自己的 session。

已被舊版同步過去的裝置無法回收（無從分辨 session 來源）：受影響使用者在要用的裝置重新登入即取得新 auth key，自然解除衝突；舊 session 可於 Telegram 裝置清單手動撤銷。

### b. 重建不重疊（`tgAdapter.js` + `tgOffscreenController.js`）

- `tgAdapter`：新增 `teardownClient`（**destroy 優先**，一併終結 update loop 與內部 autoReconnect；fallback disconnect），四處拆除點統一走它；公開 `disconnect()` 回傳拆除 promise。
- `tgOffscreenController`：`teardownDone` promise 鏈——`connect` 重建前 `await` 舊 client 拆除完成（await 後 recheck generation，覆蓋等待期間的 disconnect/新 connect）；`resolveChannel` 遇 `adapter === null` 也先等鏈清空再判斷（重建拆除窗口內不得誤建臨時 client 與垂死連線併發）。

### c. tg 內容身分比對（`feedManager.js`）

新增 `tgConfigIdentity(config, keys)` 純函式（`enabled`/`channels`/`keys.tg`，**刻意排除 `updatedAt`**）；`handleNewswireConfigChange` 於 tg 身分未變時保留既有 tg adapter 不拆，其他源維持原本粗粒度全拆重建（WS 重建廉價）。

排除的替代方案：per-source 細粒度 rebuild（其他源不需要，改動面大）；把 keys 拆成獨立 storage key（動 schema，T2，收益不成比例）。

## 影響面

| 檔案 | 變更 |
|---|---|
| `modules/newswire/newswireSyncLogic.js` | `stripTgSession` + `mergeNewswireState` syncKeys 分支 |
| `modules/newswire/tgAdapter.js` | `teardownClient`（destroy 優先）、`disconnect()` 回傳 promise |
| `modules/newswire/tgOffscreenController.js` | `teardownDone` 鏈、connect await 拆除、resolveChannel 等鏈 |
| `modules/newswire/feedManager.js` | `tgConfigIdentity` + `handleNewswireConfigChange` keepTg |

storage schema、manifest、跨 context 訊息協定（`tg:*`）皆不變。Drive payload 形狀不變（僅 `keys.tg.session` 欄位不再出現，舊 client 讀新 payload 只是拿不到 session → needs-login，無相容性風險）。

## Test Impact

- `newswireTgSync.test.mjs`：**翻轉**原「session IS in payload」測試 → session 絕不進 payload；新增 legacy 遠端 session 不落地、本機 tg 憑證整組保留（遠端較新有/無 tg 條目兩情境）、`stripTgSession` 引用相等（no-op guard 不受擾動）。
- `tgOffscreenController.test.mjs`：新增「重建等舊拆除才建新」（★ 修正前 fail）、「拆除等待期間 disconnect 收手」、「resolveChannel 落在拆除窗口不建臨時 client」。
- `newswireTgAdapter.test.mjs`：新增「disconnect 回傳可等待 promise」（★ 修正前 TypeError）、「destroy 優先於 disconnect」（★ 修正前 fail）。
- `feedManagerTgWatchdog.test.mjs`：新增 `tgConfigIdentity` 三組（rules/prefs/他源 key/updatedAt 不變身分、enabled/channels/keys.tg 變更身分、null 安全）。
- `handleNewswireConfigChange` 的 keepTg 佈線（5 行）無直接整合測試：feedManager 硬連 chrome 綁定的 adapter 工廠，stub 成本不成比例；決策核心已抽為純函式覆蓋。
- 驗證指令：`npx jest --maxWorkers=2 usecase_tests/unit_tests/`（新增 13 tests，全套 682 綠）。回歸證明：stash 四個 module 後跑四個測試檔 = 4 suites / 11 tests fail（初版）；憑證整組保留另以 stash 驗證對初版 fail。

## 驗收條件

- [x] syncKeys ON 時 Drive payload 不含 `keys.tg.session`；遠端 legacy session 不合入本機；本機持有 session 期間整組 tg 憑證不因整包 LWW 遺失或被換組（unit 鎖定）
- [x] tg 重建路徑上，新 client 於舊 client 拆除 resolve 後才建立；捨棄 client 走 destroy 優先（unit 鎖定）
- [x] 改 rules/prefs/其他源 key 不重建 tg 連線；改 tg enabled/channels/keys.tg 才重建（純函式 unit 鎖定 + 佈線目測）
- [x] 全 unit suite 綠；lint-check 無新增問題（117 處 `$eval` 為既有 puppeteer 測試基線，非本次引入）
