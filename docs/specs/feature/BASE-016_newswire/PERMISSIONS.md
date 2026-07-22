# BASE-016 newswire — 權限與隱私揭露（CWS 審查備註）

> 供 Chrome Web Store 審查與隱私政策更新參考。newswire 為**預設全關**的
> opt-in 功能：使用者未在設定啟用任何來源前，不會有任何網路連線或通知行為。

## Manifest 權限變更

| 權限 | 由本功能新增？ | 用途 | 最小化說明 |
|---|---|---|---|
| `notifications` | ✅ N4 新增 | 對使用者標記為 P0（重大：CPI/FOMC/央行利率決議等）的快訊發系統通知，側邊欄未開啟時仍能即時得知；點擊開啟原文 | 僅在使用者啟用來源**且**未關閉通知開關（預設開、可關）時觸發；通知內容僅來源標籤＋快訊標題，不含個資 |
| `host_permissions: *://*/*` | ❌ 既有（RSS 已用） | 連線使用者自行啟用之官方新聞來源的 WSS/REST 端點（Tree of Alpha、FinancialJuice、Alpaca、金十官方）；各端點網域不固定且依使用者選擇，故沿用既有廣域授權 | 僅連線使用者在設定中**明確啟用**的來源；未啟用＝零連線 |
| `alarms` / `storage` / `identity` | ❌ 既有 | alarms：SW keepalive watchdog；storage：本機設定與事件 ring buffer；identity：Google Drive appdata 設定同步（沿用既有機制） | — |

## 資料流與隱私

- **網路連線**：僅連使用者 opt-in 之**官方公開端點**。金十非官方端點依其 ToS **明文排除**，不內建。
- **API keys**：預設只存本機 `chrome.storage.local`（比照 `aiProviderSettings`）；使用者可另行 opt-in 讓 keys 隨 **自己的** Google Drive appdata 同步（預設關；關閉時清除遠端已存的 keys）。keys 絕不傳送給本套件作者或任何第三方。
- **快訊事件資料**：僅存本機 ring buffer（上限 300 則），**不**上傳雲端、**不**進入 Drive appdata。
- **無遙測**：本功能不新增任何使用者行為追蹤。
- **來源服務條款**：各來源之 API key 由使用者自行申請並遵守該來源條款；設定頁的引導文案已提醒（含金十「未經授權不得再分發／商用」聲明）。

## 隱私政策更新建議句（zh-TW / en）

- zh-TW：「若您啟用『快訊』功能，本擴充功能會連線您自行選擇並提供憑證的官方財經新聞來源，以在側邊欄顯示即時快訊；重大事件可選擇性地以系統通知提示。您的 API 金鑰預設僅儲存於本機，除非您主動開啟同步至您個人的 Google Drive。」
- en: "If you enable the News Feed feature, the extension connects to the official financial-news sources you choose and provide credentials for, to show a live feed in the side panel; high-priority events may optionally raise a system notification. Your API keys are stored locally by default unless you opt in to sync them to your own Google Drive."
