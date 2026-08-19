# BASE-029：OpenAI 相容端點支援自訂 HTTP headers

## 背景與問題

「AI 與實驗」設定頁的 OpenAI 相容端點目前只能設定 Base URL / API key / Model。
自架的私有端點常放在額外的存取防護之後（例如 Cloudflare Access service token，
要求每個請求帶 `CF-Access-Client-Id` / `CF-Access-Client-Secret`），或使用
`Authorization` 以外的自訂認證 scheme。這類使用者目前無法把 extension 接上
自己的端點。

## 方案

在 openai provider config 新增 optional 欄位 `extraHeaders`：多行字串、每行
`Name: value`，由 options 頁以 textarea 輸入，隨其他欄位存於
`chrome.storage.local`（與 apiKey 同等敏感度、不進 sync）。

- 解析：`parseExtraHeaders()` 純函式 — 以第一個 `:` 切分、跳過無冒號或空
  name/value 的行、header name 轉小寫（使用者輸入 `Authorization:` 時能覆蓋
  apiKey 衍生的 `authorization`，而非產生重複 header）。
- 套用：`Object.assign(headers, extras)` 放在最後 — 使用者明確輸入者優先於
  衍生預設值。三條路徑全數涵蓋：`buildChatRequest`（chat 與 streaming 共用）
  與 `testConnection` 的 `/models` 探測（漏掉後者會使 Access 防護下的
  「測試連線」永遠失敗）。
- 儲存格式選字串而非物件：`mergeWithDefaults` 只合併非空字串值，物件會被
  靜默丟棄 — 這是既有 merge 層的約束，非風格選擇。

排除的替代方案：key/value 成對輸入列 UI（多元件、多狀態，textarea 一行一個
已足夠）；ollama provider 同步加入（自有 `buildChatRequest`，未在需求內，
之後要加是一行事）。

## 影響面

- `modules/ai/providers/openaiCompatProvider.js`：新增 `parseExtraHeaders`
  export；`buildChatRequest` / `testConnection` 套用 extras。
- `modules/ai/providerSettings.js`：openai 預設值新增 `extraHeaders: ''`。
  additive optional 欄位、缺值即現行為、無 migration（T1 依據）。
- `options.js`：`AI_PROVIDER_FIELDS.openai` 加欄位、label、textarea 分支。
- `_locales/*/messages.json` ×14：新 key `aiProviderExtraHeadersLabel`。
- 無新檔案（Makefile 打包清單不需動）；模組職責不變（GEMINI.md 不需動）。

## Test Impact

- `usecase_tests/unit_tests/aiProviders.test.mjs` 新增 4 案：解析/跳過/小寫、
  buildChatRequest 合併、使用者 `Authorization:` 覆蓋 Bearer、`/models` 探測
  帶 extras。
- 驗證指令：`npx jest usecase_tests/unit_tests/aiProviders.test.mjs`
  與 `usecase_tests/unit_tests/providerSettings.test.mjs`。

## 驗收條件

- [x] openai 設定區出現「自訂標頭」textarea，內容持久化於 storage.local。
- [x] chat、streaming、測試連線三路徑的請求皆帶上使用者設定的 headers。
- [x] 使用者輸入的 `Authorization:` 覆蓋 apiKey 衍生的 Bearer，不重複。
- [x] 空白/無效行被忽略；欄位留空時行為與現行完全相同。
- [x] 14 個 locale 皆有新 label key；單元測試綠燈。
