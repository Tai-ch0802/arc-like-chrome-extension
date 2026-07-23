# PRD — newswire Telegram 源（MTProto user session）

| 欄位 | 值 |
|---|---|
| ID | BASE-018 |
| 分級 | **T2**（Phase 1：PRD）——新 runtime 依賴＋全新登入流程＋最高敏感度憑證 |
| 狀態 | Draft v1.0 — 待 User Review（Gate 1） |
| 日期 | 2026-07-23 |
| 前置 | BASE-016 newswire（已合併）；BASE-017 UX 強化 |
| 下游 | 同目錄 `SA_spec.md`（Phase 2） |

---

## 1. Introduction

### 1.1 Problem Statement

大量高價值財經快訊的第一手來源在 Telegram 頻道（@WalterBloomberg、@BWEnews、交易所官方公告頻道等），且往往**比 X 更上游**。現有四源（Tree/FJ/Alpaca/金十）無法覆蓋這一塊。Telegram **Bot API 走不通**——bot 只能讀自己當管理員的頻道；**MTProto user session** 才能訂閱任意公開頻道，且為官方支援的客戶端行為：一條 session 可掛上百個頻道、`NewMessage` 事件即真 push、零輪詢、零費用。

### 1.2 Goals

1. 使用者可把任意**公開 Telegram 頻道**加入快訊來源，訊息與現有四源同管線呈現（去重／分級／通知／搜尋／清除一體適用）。
2. 提供**策展頻道清單**（含驗證狀態與仿冒風險警示）供一鍵加入參考。
3. 引導使用者完成 MTProto user session 設定：my.telegram.org 申請 `api_id`/`api_hash` → 手機號登入（驗證碼＋選配 2FA）→ **強烈建議使用小號**。
4. session 憑證以**最高敏感度**對待：僅存本機、**永不進任何同步管道**（含 key opt-in——明確排除）、提供一鍵登出撤銷。

### 1.3 Success Metrics

| 指標 | 目標 |
|---|---|
| 頻道訊息 → sidepanel 顯示延遲 | ≤ 3 秒 |
| 單 session 可訂頻道數 | ≥ 100（MTProto 天然支援，UI 不設硬限） |
| 登入流程完成率（有引導下） | 一次流程 ≤ 5 分鐘可完成 |

---

## 2. User Stories

- **US-1**：作為看盤使用者，我想訂閱 @WalterBloomberg／@BWEnews 這類頻道，讓 TG 上的第一手快訊直接進側邊欄，不用開著 Telegram。
- **US-2**：作為新手，我想要一份「已驗證的頻道清單」與逐步設定引導，不想自己研究 MTProto。
- **US-3**：作為注重安全的使用者，我要清楚知道 session 的風險等級（≈完整帳號存取權），並被引導用小號；session 絕不可離開本機。
- **US-4**：作為使用者，我想隨時登出並撤銷此 session（本機清除＋遠端 revoke）。

## 3. Functional Requirements（EARS）

### 3.1 設定與登入

- **FR-01**：The system shall 在 options 快訊 section 新增 Telegram 來源卡：`api_id`／`api_hash` 欄位（遮罩）、登入流程入口、頻道管理、策展清單。附逐步引導文案：my.telegram.org 申請憑證、**建議使用小號**、風險說明。
- **FR-02**：WHEN 使用者發起登入，the system shall 依序引導：手機號 → Telegram 送達的驗證碼 → （帳號有 2FA 時）密碼；全程於 options 頁進行，成功後產生 session 並顯示已登入帳號（遮蔽手機號中段）。
- **FR-03**：The system shall 提供「登出並撤銷」：呼叫官方 `auth.logOut`（使遠端 session 失效）＋清除本機 session 與 api 憑證。
- **FR-04（安全硬規則）**：session 字串 shall 僅存 `chrome.storage.local`，且 shall **排除於一切同步**之外——不進 chrome.storage.sync、不進 Drive appdata payload（**即使 key opt-in 開啟**，`stripKeys`/payload 組裝層面明確排除 tg session）；UI 於登入前顯示風險告知（session ≈ 完整帳號存取權）。

### 3.2 頻道訂閱

- **FR-05**：The system shall 支援以 `@handle` 或 `t.me/...` 連結新增**公開頻道**；加入前解析並顯示頻道名稱／訂閱數供確認（防 handle 打錯與仿冒）。
- **FR-06**：The system shall 內建**策展頻道清單**（靜態資料隨版更新）供一鍵加入，每項含簡介與驗證註記；初版收錄（依使用者提供之查核表）：

| 頻道 | 內容 | 註記 |
|---|---|---|
| @WalterBloomberg | 宏觀/地緣/個股 breaking 頭條（彭博終端風格），與 @DeItaone 同運營 | ✅ 已驗證、活躍 |
| @firstsquaw／@firstsquawk | First Squawk：24 小時專業 squawk 文字頭條 | ⚠️ **兩個相似 handle 並存，接入前務必驗證哪個是官方**——TG 仿冒頻道是常態風險（清單 UI 需醒目標示） |
| @BWEnews 方程式新聞 | 最快華語加密＋宏觀突發，中英雙語，免費 | ✅ 加密圈公認速度標竿 |
| @WatcherGuru | 即時 crypto 與 finance 頭條 | ✅ |
| @binance_announcements／@binance_cn | 幣安官方英/中公告 | **比 X 更上游的一手源** |
| @tnews365 竹新社 | 7×24 編譯國內外媒體即時新聞（中文） | 泛新聞補充源 |

- **FR-07**：The system shall 監聽已訂頻道的 `NewMessage` 事件（真 push），正規化為 `NewsEvent`（source `tg`、來源徽章顯示頻道名、`url = t.me/<channel>/<msgId>` 點擊開原文），進入既有管線（L1 去重／規則分級／P0 通知／ring buffer／搜尋／清除全部一體適用）。
- **FR-08**：The system shall 支援逐頻道移除；Telegram 來源整體 enable toggle 與其他源一致（關閉＝斷線）。

### 3.3 狀態與韌性

- **FR-09**：連線狀態沿用既有狀態集（connecting/connected/retrying/degraded/needs-key——tg 的 needs-key ＝「未完成登入」）；FLOOD_WAIT 類限流 shall 遵守伺服器指示的等待秒數（不硬重試）。
- **FR-10**：session 失效（他端撤銷／FR-03 登出）shall 呈現「需重新登入」並停止重連，不打登入迴圈。

## 4. Acceptance Criteria（節錄，GWT 全表於 SA 核准後補齊）

- **AC-01**：Given 未登入，When 開啟 Telegram 卡，Then 顯示 api_id/api_hash 欄、引導文案與小號建議；填入並完成 手機號→驗證碼（→2FA）流程後顯示已登入帳號。
- **AC-02**：Given 已登入並加入 @BWEnews，When 該頻道發布新訊息，Then ≤3 秒內出現於快訊列表（徽章顯示頻道名），點擊開 `t.me/BWEnews/<id>`。
- **AC-03**：Given key opt-in（Drive 同步 keys）**開啟**，When 同步發生，Then Drive payload 內**不含** tg session 與 api_hash（硬排除驗證）。
- **AC-04**：Given 使用者點「登出並撤銷」，Then 遠端 session 失效（他端 active sessions 清單消失）＋本機 session 清除＋來源顯示需重新登入。
- **AC-05**：Given 策展清單中的 First Squawk 項目，Then 顯示仿冒風險警示且不預設任一 handle，要求使用者自行核實後選擇。

## 5. Out of Scope（v1）

1. 私有頻道／群組／個人對話（僅公開頻道）。
2. Bot API 路線（能力不足，如 §1.1）。
3. 訊息圖片／媒體呈現（只取文字，媒體訊息以 caption 或「[媒體]」佔位）。
4. 多帳號 session、在延伸內瀏覽頻道歷史訊息（只收新訊息）。
5. 代管憑證或任何形式的伺服器中繼——一切連線由使用者裝置直連 Telegram。

## 6. Non-Functional / 合規

- **MV3 合規**：MTProto 客戶端為**打包進套件的程式碼**（無遠端程式碼）；連線走 `wss://`（Telegram 官方 web 端點），`host_permissions` 既有廣域已涵蓋；無新權限需求。
- **ToS**：使用官方 API（my.telegram.org 核發之 api_id/api_hash）＋官方客戶端行為（user session 訂閱公開頻道），與 Telegram ToS 相容；引導文案提醒使用者遵守 Telegram 服務條款與各頻道轉載限制。
- **CWS 揭露**：PERMISSIONS.md 增補 Telegram 連線用途與 session 本機儲存聲明。

## Revision History

| 版本 | 日期 | 變更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-23 | 初稿：MTProto user session 路線（使用者指定）、策展清單收錄、session 安全硬規則 | Tai / Claude 協作 |
