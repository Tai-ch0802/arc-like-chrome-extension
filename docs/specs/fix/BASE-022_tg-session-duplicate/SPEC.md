# SPEC — BASE-022 修復 Telegram session 被 AUTH_KEY_DUPLICATED 作廢

| 欄位 | 值 |
|---|---|
| 分級 | T1（延伸既有 `tg:*` / `newswire:*` 協定，非新增或重切協定） |
| 來源 | 使用者實測回報：已登入卻顯示「需填入 API key」，且按鈕無反應 |
| 嚴重度 | 高 — 使用者正常操作（加頻道）就會讓 session 被伺服器作廢，功能實質不可用 |

## 背景與根因

使用者登入 Telegram 後連續加入 8 個頻道，隔天發現快訊停止、狀態顯示「需填入 API key」，但 storage 中 session（381 字元）、`apiId`、`apiHash` 都完好，Telegram 的裝置清單裡該 session 也還在。

以 vendored bundle 在 options 頁直接建 client 連線，逼出被吞掉的原始錯誤：

```
AUTH_KEY_DUPLICATED
Concurrent usage of the current session from multiple connections was detected,
the current session was invalidated by the server for security reasons!
```

**根因是 SA 階段的架構決策缺陷**：同一個 session 被兩處各自建立連線。

| 位置 | 連線 | 觸發頻率 |
|---|---|---|
| offscreen document | `tgAdapter` 的**常駐**收訊連線 | 持續 |
| options 頁 | `tgLoginController.resolveChannel` 為「加頻道前防仿冒確認」**另建短命 client** | 每加一個頻道一次 |

MTProto 對同一 auth key 的併發連線直接判定為安全風險並作廢 session。加 8 個頻道 ＝ 8 次併發。

**為何裝置清單看起來正常**：Telegram 作廢的是 auth key，不是移除 device 項目，所以從手機端看不出異常——這也是初期診斷被誤導的原因。

**為何 UI 文案完全對不上**：`classifyTgError` 把「session 失效」與「api_id 無效」都歸為單一 `fatal`，一律回報 `needs-key`，於是 session 被作廢時顯示「需填入 API key」——而 key 從未有問題。

## 方案

### 1. offscreen 成為唯一能用 session 連線的地方（根因修復）

- `tgAdapter.resolveChannel(username)`（新）：用**既有連線**呼叫 `getEntity`，不另開連線
- `tgOffscreenController.resolveChannel(cfg, username)`（新）。不變式：**adapter 存在 ⇒ 絕不另建連線**
  - adapter 存在 → 等它就緒後借用；逾時或終止態則報 `TG_NOT_READY`，**不 fallback**
  - adapter 不存在（tg 未啟用）→ 臨時建一條、用完立刻斷（`finally` 保證）

**為何不能只看 `isAlive()`**（PR #212 review 抓到的殘餘窗口，初版修法漏掉）：`open()` 內從 `createClient()`（dynamic import 2.6M bundle）到 `client.connect()`（MTProto DH 交換）完成之間，`isAlive()` 一路是 `false` 但連線正在建立，窗口達秒級到十秒級。而 options 登入後寫完 storage 就立刻顯示加頻道 UI（不等 SW 連上），**使用者「登入後連續加頻道」——正是原始 bug 的操作模式——恰好落在窗口內**，於是初版修法在該路徑仍會另建臨時連線、製造同一個併發。

逾時亦不可 fallback：逾時只代表「還在連」，fallback 就是併發。故 adapter 存在時一律等待，並以 `isFailed()` 讓終止態（session 失效／憑證錯）立刻收手而非白等 20 秒。上限 20s 必須 < `resolveTgChannel` 的 30s `sendMessage` 逾時，否則 options 端收到的會是無意義的逾時而非明確錯誤碼。
- `offscreen.js` 新增 `tg:resolveChannel` handler（回應式，比照 `tg:ping`）
- `feedManager.resolveTgChannel()` + `newswire:tgResolveChannel` handler：由 SW 轉發（只有 SW 能 `ensureOffscreenDocument`，options 無此權限）
- `options.js` 的 `addChannel` 改為發訊息，**不再自建 client**

「未啟用時要求先啟用」的替代方案被排除：使用者體驗較差，且臨時連線在無常駐連線的前提下本就安全。

### 2. 錯誤分類細分（UX 修復）

`classifyTgError` 的 fatal 增加 `reason`：

| 錯誤 | reason | 狀態 | 補救動作 |
|---|---|---|---|
| `AUTH_KEY_*`、`SESSION_*`、`USER_DEACTIVATED` | `session` | **`needs-login`**（新） | 重新登入 |
| `API_ID_INVALID`、`API_ID_PUBLISHED_FLOOD` | `apiId` | `needs-key` | 檢查／更換 api_id |

兩者都終止重試（`failed = true`），僅回報狀態不同。

**`shouldReconnectTg` 不需修改**：它依 `hasAdapter`／`alive` 判斷，不看 status，故新增狀態自動被正確處理。已補測試鎖住此設計——若日後改回看 status 而漏掉新狀態，會對已作廢的 session 無限重連。

### 3. 卡片內行動指示

狀態徽章有邊框、外觀近似按鈕但不可點，使用者實際回饋是「按了沒反應，以為壞掉」。故在卡片內另加行內警示（danger 樣式），明確指向「用下方的『登出並撤銷』後重新登入」。預設隱藏，由 `applyStatuses` 依 tg 狀態 toggle（沿用 `needs-key` 行內提示的既有模式；卡片渲染當下 SW 尚未回報狀態，不能在該時點判斷）。

### 4. 兩處次要修正

- **登出鈕分離**：原本與策展清單的「+ 頻道」按鈕同排、樣式相同，使用者反映找不到。改為自成一列（上緣分隔線）＋ `danger` 樣式。
- **帳號名持久化**：登入取得的 `meName` 原本只存在記憶體，reload 後「已登入為」只剩「(session)」。改為一併寫入 `newswireKeys.tg.meName`（僅顯示名稱，敏感度遠低於 session，與 `apiId`/`apiHash` 同層處置）。

## 影響面

| 檔案 | 改動 |
|---|---|
| `modules/newswire/tgAdapter.js` | `resolveChannel` 新增；`classifyTgError` 加 `reason`；fatal 分流狀態；`isFailed` 暴露終止態 |
| `modules/newswire/tgOffscreenController.js` | `resolveChannel` 新增（+ `loadClient`／`sleep` DI）；`waitAdapterAlive` 輪詢等就緒；匯出 `TG_NOT_READY` |
| `offscreen.js` | `tg:resolveChannel` handler |
| `modules/newswire/feedManager.js` | `resolveTgChannel` + `newswire:tgResolveChannel` handler；import `ensureOffscreenDocument` |
| `options.js` | `addChannel` 改走 SW；`needs-login` 狀態 map；行內警示 + toggle；登出鈕分離；`meName` 落地；解析中換按鈕文字；`TG_NOT_READY` 換 i18n 文案 |
| `options.css` | `.tg-session-invalid`、`.tg-logout-row` |
| `_locales/*` × 14 | `newswireStatusNeedsLogin`、`tgSessionInvalidNote`、`tgResolving`、`tgNotReady`（433 → 437） |

- 無 storage schema 變更（`newswireKeys.tg` 多一個 `meName` 顯示欄位，向後相容）
- 無 manifest / 權限變更
- `tgLoginController.resolveChannel` **保留**（未被 UI 使用，但保留給診斷與未來需求；其 header 已註明不應在 offscreen 有常駐連線時使用）

## Test Impact

- `newswireTgAdapter.test.mjs`：新增「fatal 分 reason」；更新兩處既有斷言（原假設所有 fatal → `needs-key`，現分流）；`AUTH_KEY_DUPLICATED` 明確納入 `needs-login` 案例
- `tgOffscreenController.test.mjs`：新增 describe「resolveChannel 不得與常駐連線併發」6 例——★ 借用既有連線時 `clientBuilt === 0`（核心不變式）、臨時連線用完必 disconnect、`getEntity` 拋錯時仍 disconnect，以及 review 修正後的三例：★ 連線建立中（未 alive）等就緒後借用且 `clientBuilt === 0`、★ 逾時報 `TG_NOT_READY` 且不 fallback、終止態不輪詢白等。**後三例在初版修法下會 fail（實測 3 failed / 7 passed）**，是真回歸測試
- `feedManagerTgWatchdog.test.mjs`：補 `needs-login` 亦不重連
- i18n 驗證：14 語系 435 keys、格式一致、**逐一確認無語系把文案翻回「金鑰有問題」**（那會讓本修正在該語系失效）

驗證指令：`npm run test:unit`、`npm run test:ci`

## 驗收條件

- [ ] 在 tg 啟用中連續加入多個頻道，session 不再被作廢（原本第 2～8 次就會踩到）
- [ ] **登入後立刻加頻道**（常駐連線仍在建立中）亦不作廢 session——初版修法在此路徑仍會併發
- [ ] tg 未啟用時仍可加頻道（offscreen 臨時連線），且結束後無殘留連線
- [ ] session 被作廢時：徽章顯示「session 已失效，請重新登入」而非「需填入 API key」
- [ ] 同情境下卡片內出現紅框行內警示，指向「登出並撤銷」
- [ ] 「登出並撤銷」自成一列、danger 樣式，與「+ 頻道」按鈕明顯區隔
- [ ] 重新載入設定頁後，「已登入為」顯示帳號名而非「(session)」
- [ ] `api_id` 類錯誤仍顯示「需填入 API key」（未被誤併入 needs-login）

## 給未來的提醒

**任何要用 session 連 Telegram 的新功能，都必須走 offscreen**。這條不變式已由 `tgOffscreenController.test.mjs` 的 `clientBuilt === 0` 斷言守住，但那只涵蓋 `resolveChannel`；若新增其他需要 session 的操作（例如取歷史訊息、送訊息），請一併集中到 offscreen，不要在 options／sidepanel 自建 client。
