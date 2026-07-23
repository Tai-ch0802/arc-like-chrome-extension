# SA — newswire Telegram 源（MTProto user session）

| 欄位 | 值 |
|---|---|
| ID | BASE-018 |
| 分級 | **T2**（Phase 2：SA） |
| 狀態 | **Final v1.2 — 已核准（Gate 2 通過）**；T0 spike PROCEED，TG1 實作進行中 |
| 日期 | 2026-07-23 |
| 上游 | 同目錄 `PRD_spec.md` v1.1 |

---

## 1. 技術路線：GramJS（Telethon 的 JS 等價品）

使用者指定 Telethon / MTProto user session 路線。Telethon 是 Python、無法在 extension 執行；其 JS 等價品為 **GramJS**（npm `telegram` 套件，同一作者生態、API 形狀對齊 Telethon：`TelegramClient`、`StringSession`、`NewMessage` 事件）。瀏覽器端走 **MTProto over WSS**（Telegram 官方 web 端點；web.telegram.org 即為此模式的既存先例），MV3 SW 內可用（WebSocket＋WebCrypto/BigInt 皆可用；session 用 `StringSession` 存記憶體＋自行持久化，不依賴 localStorage）。

**依賴引入方式（T0 spike 後修正，見 §7/SPIKE_T0.md）**：GramJS 為 CJS＋多個 Node built-in 依賴，**無法以原始碼直載於 dev 模式**，esbuild 也不能開箱 bundle。→ 定案：以專屬 polyfill build step（crypto-browserify 等，見 §7）**預打包成單一 vendored bundle 放 `lib/telegram.bundle.js`（比照 `lib/Sortable.min.js`）**，以全域方式匯入；dev 與 prod 皆載入此 vendored bundle（不走 from-source esbuild）。bundle 1.3M min / 383K gzip。

## 2. Module Impact Map

| 檔案 | 變更 |
|---|---|
| `modules/newswire/tgAdapter.js`（NEW） | GramJS 客戶端包裝：以 StringSession 建線、`addEventHandler(NewMessage, {chats})`、FLOOD_WAIT 遵守、session 失效→`needs-key` 終止（FR-10）；實作既有 `Adapter` 介面（connect/disconnect/isAlive）納入 feedManager |
| `modules/newswire/normalizer.js` | +`parseTgMessage`（純函式：GramJS message → NewsEvent；source `tg`、sourceId `${chatId}:${msgId}`、url `t.me/<username>/<msgId>`、媒體訊息取 caption 否則「[媒體]」佔位） |
| `modules/newswire/tgAuth.js`（NEW） | options 端登入編排：`signInWithCode` 流程（phone→code→2FA password）、`auth.logOut` 撤銷、session 字串產出 |
| `modules/newswire/tgChannels.js`（NEW） | 策展清單靜態資料（PRD FR-06 表格,含 verified/warning 註記）＋`resolveChannel`（handle/t.me 連結 → 頻道資訊確認） |
| `modules/newswire/feedManager.js` | ADAPTER_FACTORIES +tg；`missingCreds` +tg（`session && apiId && apiHash`）；handleRaw +tg case；defaultNewswireConfig.sources +tg（`{enabled:false, channels:[], updatedAt}`） |
| `modules/newswire/newswireSyncLogic.js` | **無需 sync 層特殊碼**：`mergeKeys` 是整包 LWW，`newswireKeys.tg`（session/apiHash）自動搭既有 keys 同步的便車，與其他源走**同一 `prefs.syncKeys` 開關**（開→進 Drive、關→scrub）。只需把 `'tg'` 加入 `NEWSWIRE_SOURCE_IDS`（明確化固定源集合＋沿用 UNSAFE_KEYS 原型防護；因 `mergeNewswireConfig` 本就保留未知源 id，config 同步不加也可）。測試驗 on/off/scrub |
| `options.js` | Telegram 來源卡（登入流程 UI、頻道管理清單、策展清單一鍵加入、登出撤銷 danger 鈕）；tg key 欄位（apiId/apiHash/session，password 遮罩，經 `rmwNewswireKeys` 寫入＝與其他源同一 keys 路徑）；**當已存在 tg session 且使用者要開啟既有 key 同步 toggle 時，額外顯著警示**（session ≈ 完整帳號存取權、將上雲）——揭露措施，非阻擋 |
| `PERMISSIONS.md` | Telegram 連線用途與 session 本機儲存聲明 |
| `_locales` ×14 | 約 +20 keys（登入流程/風險告知/頻道管理/策展註記） |

## 3. Storage Schema Diff

| Key | Area | 變更 |
|---|---|---|
| `newswireConfig.sources.tg` | local | NEW：`{enabled, channels:[{id, username, title, addedAt}], updatedAt}` — **channels 隨 config 無條件進 Drive 同步**（非敏感，跨裝置漫遊有價值；per-source LWW 沿用，與 jin10 categories 同機制、不受 key opt-in 影響） |
| `newswireKeys.tg` | local | NEW：`{apiId, apiHash, session, account}` — 與其他源 keys **同一 opt-in 同步模型**：預設不同步，`syncKeys=true` 時進 Drive appdata、關閉時 scrub（§2）；因 session ≈ 完整帳號存取權，UI 於開啟同步前顯著風險告知 |

## 4. 訊息流

```
[options] tgAuth 登入(互動) → session 字串 → newswireKeys.tg(local)
    → onChanged → SW feedManager 重建 → tgAdapter connect(StringSession)
    → GramJS NewMessage(chats=[...]) → parseTgMessage → 既有管線
      (dedupe → rules → buffer → 廣播/通知/搜尋/清除 全沿用)
```

## 5. 安全設計（本案核心風險）

| 風險 | 對策 |
|---|---|
| session ≈ **完整帳號存取權**（比 API key 嚴重一個量級） | 預設本機、預設不同步；納入既有 key opt-in（開啟才進 Drive、關閉即 scrub，單元測試鎖 on/off/scrub 行為）；**登入前與開啟同步前皆顯著風險告知 modal**（session ≈ 完整帳號存取權；開啟同步＝憑證離開本機進雲端 Drive）；引導使用小號；「登出並撤銷」一鍵（遠端 revoke＋本機清除＋若曾同步則下次同步一併從 Drive scrub） |
| 仿冒頻道（First Squawk 兩 handle 並存） | 策展清單醒目警示；加入前 resolve 顯示頻道名/訂閱數確認 |
| FLOOD_WAIT／rate limit | 遵守伺服器等待秒數；加頻道操作節流 |
| GramJS 供應鏈 | 鎖定版本＋`npm audit` 納入既有 dependabot 流程；bundle 進包＝送審內容可稽核 |

## 6. Test Impact

- unit：`parseTgMessage` fixtures、tgChannels resolve/清單資料健全性、**syncLogic tg opt-in**（syncKeys=false 時 payload 無 tg；syncKeys=true 時 payload 含 tg；由開啟改關閉後 tg 從 payload 被 scrub——沿用既有 newswireSyncLogic.test 模式擴充）、tgAdapter 狀態機（沿 fake 驅動模式：FLOOD_WAIT、session 失效→needs-key 不迴圈）。
- E2E：options 卡渲染與未登入態（零真連線）；登入流程與真頻道接收屬手動矩陣。

## 7. T0 Spike — ✅ 已執行（2026-07-23，結論見 `SPIKE_T0.md`）

**結論：PROCEED（有條件）。** 摘要（完整見 SPIKE_T0.md）：

1. **GramJS 在瀏覽器可用**：`telegram@2.26.22` bundle 可載入、`TelegramClient`＋`StringSession` 可建構（無 Node API 崩潰）；**核心 crypto（crypto-browserify sha256/randomBytes）實測與 Node 一致**；瀏覽器 WSS transport 實測會選中並連向 Telegram 官方 web DC `vesta.web.telegram.org:443`（用瀏覽器原生 WebSocket）。**完整握手＋真登入＋真 NewMessage 接收需真 api_id/api_hash＋手機 → 使用者跑 harness 驗證**（列手動矩陣）。
2. **bundle：1.3M min / 383K gzip**（< 2MB 目標內）。但 **esbuild 不能開箱 bundle**——需 polyfill build step：alias `crypto→crypto-browserify`（核心路徑不可省）／`stream`/`path`/`events`/`util`、functional `os` shim、`fs`/`net`/`tls`/`socks`/`node-localstorage` 空存根、inject `Buffer`/`process`。
3. **`make` dev 模式須改**：GramJS（CJS＋Node 依賴）無法以原始碼直載 → **預打包成 vendored bundle 放 `lib/`（比照 `lib/Sortable.min.js`），全域匯入**。此為對 §1「依賴引入方式」的修正：不走 from-source esbuild，改 vendored bundle。
4. **options→SW 登入交棒**：options 頁 `client.start`（互動）→ `session.save()` 字串 → `newswireKeys.tg`（local）→ SW tgAdapter 以字串重建（已驗證建構自 session 字串可行）。
5. **keepalive 相容**：GramJS 內建 ping loop 送 WS 流量重置 SW idle timer；SW 回收由既有 `newswireWatchdog` alarm 重連；session 字串持久化於 storage.local 供重建。

**未竟項（正式 TG1 前）**：使用者跑 harness 確認真登入＋接收；正式擴充 SW→Telegram web DC 的實連確認（in-app 瀏覽器 sandbox 下 TIMEOUT，但正式擴充有廣域 host_permissions，預期無阻擋）。

若使用者判定 1.3M 體積不可接受 → 備援：Telethon 桌面小工具 + 本機 WS 橋接（體驗較差，僅 fallback）。

## 8. 實作 Phase（SA 核准後）

| Phase | 內容 |
|---|---|
| **T0** | §7 spike（1–2 晚,scratch 不入版控） |
| **TG1** | tgAdapter＋parseTgMessage＋feedManager 納管＋tg keys 納入既有 opt-in 同步路徑（'tg' 入 NEWSWIRE_SOURCE_IDS；含 on/off/scrub 測試） |
| **TG2** | options 卡（登入/頻道管理/策展清單）＋i18n＋PERMISSIONS.md |
| **TG3** | 手動矩陣（真帳號登入、百頻道壓測、FLOOD_WAIT、跨端撤銷） |

## Revision History

| 版本 | 日期 | 變更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-23 | 初稿：GramJS 路線、session 安全硬規則、T0 spike 條件 | Tai / Claude 協作 |
| v1.1 | 2026-07-23 | 依 PR #192 意見：session/api_hash 改為納入既有 key opt-in 同步（取代同步硬排除；`mergeKeys` 整包 LWW 自動涵蓋 tg，僅需 'tg' 入 NEWSWIRE_SOURCE_IDS）；連動更新 §2 Module Map、§3 storage schema、§5 安全設計、§6 測試、§8 TG1 | Tai / Claude 協作 |
| v1.2 | 2026-07-23 | T0 spike 執行完成（SPIKE_T0.md）：GramJS 可行性 de-risk，PROCEED（有條件）；§1 依賴引入改為 vendored bundle 進 lib/（1.3M）、§7 回填四問題結論；未竟項＝使用者跑 harness 確認真登入/接收 | Tai / Claude 協作 |
