# SA — newswire Telegram 源（MTProto user session）

| 欄位 | 值 |
|---|---|
| ID | BASE-018 |
| 分級 | **T2**（Phase 2：SA） |
| 狀態 | Draft v1.0 — 待 User Review（Gate 2，PRD 核准後定稿） |
| 日期 | 2026-07-23 |
| 上游 | 同目錄 `PRD_spec.md` v1.0 |

---

## 1. 技術路線：GramJS（Telethon 的 JS 等價品）

使用者指定 Telethon / MTProto user session 路線。Telethon 是 Python、無法在 extension 執行；其 JS 等價品為 **GramJS**（npm `telegram` 套件，同一作者生態、API 形狀對齊 Telethon：`TelegramClient`、`StringSession`、`NewMessage` 事件）。瀏覽器端走 **MTProto over WSS**（Telegram 官方 web 端點；web.telegram.org 即為此模式的既存先例），MV3 SW 內可用（WebSocket＋WebCrypto/BigInt 皆可用；session 用 `StringSession` 存記憶體＋自行持久化，不依賴 localStorage）。

**依賴引入方式**：npm devDependency＋esbuild bundle 進 background（沿用既有 prod bundle 管線）；不 vendor 原始碼進 lib/（GramJS 體積大、有上游更新需求）。dev（`make`）模式因 modules/ 為原始碼直載，**需評估**：GramJS 為 CJS/ESM 混合——SA 定稿前的 **T0 spike 必辦**（見 §7）。

## 2. Module Impact Map

| 檔案 | 變更 |
|---|---|
| `modules/newswire/tgAdapter.js`（NEW） | GramJS 客戶端包裝：以 StringSession 建線、`addEventHandler(NewMessage, {chats})`、FLOOD_WAIT 遵守、session 失效→`needs-key` 終止（FR-10）；實作既有 `Adapter` 介面（connect/disconnect/isAlive）納入 feedManager |
| `modules/newswire/normalizer.js` | +`parseTgMessage`（純函式：GramJS message → NewsEvent；source `tg`、sourceId `${chatId}:${msgId}`、url `t.me/<username>/<msgId>`、媒體訊息取 caption 否則「[媒體]」佔位） |
| `modules/newswire/tgAuth.js`（NEW） | options 端登入編排：`signInWithCode` 流程（phone→code→2FA password）、`auth.logOut` 撤銷、session 字串產出 |
| `modules/newswire/tgChannels.js`（NEW） | 策展清單靜態資料（PRD FR-06 表格,含 verified/warning 註記）＋`resolveChannel`（handle/t.me 連結 → 頻道資訊確認） |
| `modules/newswire/feedManager.js` | ADAPTER_FACTORIES +tg；creds 判定：`session && apiId && apiHash`；handleRaw +tg case |
| `modules/newswire/newswireSyncLogic.js` | **硬排除**：payload 組裝層過濾 `keys.tg`（session/apiHash 永不進 Drive，即使 syncKeys=true）——含測試 |
| `options.js` | Telegram 來源卡（登入流程 UI、頻道管理清單、策展清單一鍵加入、登出撤銷 danger 鈕） |
| `PERMISSIONS.md` | Telegram 連線用途與 session 本機儲存聲明 |
| `_locales` ×14 | 約 +20 keys（登入流程/風險告知/頻道管理/策展註記） |

## 3. Storage Schema Diff

| Key | Area | 變更 |
|---|---|---|
| `newswireConfig.sources.tg` | local | NEW：`{enabled, channels:[{id, username, title, addedAt}], updatedAt}` — **channels 隨 config 進 Drive 同步**（非敏感，跨裝置漫遊有價值；per-group LWW 沿用） |
| `newswireKeys.tg` | local | NEW：`{apiId, apiHash, session, account}` — **同步硬排除**（§2；與其他源 keys 不同：連 opt-in 都不同步） |

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
| session ≈ **完整帳號存取權**（比 API key 嚴重一個量級） | local-only＋同步硬排除（雙層：payload 過濾＋單元測試鎖行為）；登入前風險告知 modal；引導使用小號；「登出並撤銷」一鍵（遠端 revoke＋本機清除） |
| 仿冒頻道（First Squawk 兩 handle 並存） | 策展清單醒目警示；加入前 resolve 顯示頻道名/訂閱數確認 |
| FLOOD_WAIT／rate limit | 遵守伺服器等待秒數；加頻道操作節流 |
| GramJS 供應鏈 | 鎖定版本＋`npm audit` 納入既有 dependabot 流程；bundle 進包＝送審內容可稽核 |

## 6. Test Impact

- unit：`parseTgMessage` fixtures、tgChannels resolve/清單資料健全性、**syncLogic tg 硬排除**（syncKeys=true 時 payload 仍無 tg）、tgAdapter 狀態機（沿 fake 驅動模式：FLOOD_WAIT、session 失效→needs-key 不迴圈）。
- E2E：options 卡渲染與未登入態（零真連線）；登入流程與真頻道接收屬手動矩陣。

## 7. T0 Spike（SA 定稿前硬前置，結果回填本文件）

1. GramJS 在 **MV3 SW** 實連（StringSession 記憶體＋自行持久化）：connect→NewMessage 接收實測。
2. **bundle 體積**與 esbuild 相容性（目標：background bundle 增量 < 2MB）；`make` dev 模式的載入方案。
3. 登入流程在 options 頁跑通（GramJS 於 DOM 頁面執行 auth、session 交棒 SW）。
4. 長連線與既有 keepalive/watchdog 的相容性（GramJS 內建 ping 是否足以維持 SW 存活）。

任一 spike 不過 → 回報並重新評估路線（備援：引導使用者自架 Telethon 桌面小工具 + 本機 WS 橋接——體驗較差，僅為 fallback 記錄）。

## 8. 實作 Phase（SA 核准後）

| Phase | 內容 |
|---|---|
| **T0** | §7 spike（1–2 晚,scratch 不入版控） |
| **TG1** | tgAdapter＋parseTgMessage＋feedManager 納管＋同步硬排除（含測試） |
| **TG2** | options 卡（登入/頻道管理/策展清單）＋i18n＋PERMISSIONS.md |
| **TG3** | 手動矩陣（真帳號登入、百頻道壓測、FLOOD_WAIT、跨端撤銷） |

## Revision History

| 版本 | 日期 | 變更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-23 | 初稿：GramJS 路線、session 安全硬規則、T0 spike 條件 | Tai / Claude 協作 |
