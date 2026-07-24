# telegram-bundle-builder

Telegram 快訊源（BASE-018）GramJS 客戶端的 **vendored bundle 可重現 build recipe**。底層用 **[`teleproto`](https://github.com/sanyok12345/teleproto)**（MIT，telegram/GramJS 的 fork——見下方「授權與維護」）。build-time 工具，**不屬於擴充功能本體**、不進 `make` 打包。build 產物輸出到 `dist/`（gitignored，**刻意不落在 `lib/`**——`make` 從檔案系統整包 cp `lib/`，輸出那裡會讓任何人跑重建就把 bundle 打進包）。

## 為何 vendored

teleproto 是 CJS 套件、依賴多個 Node built-in（`crypto`/`zlib`/`stream`/`path`/`os`/…），**無法以原始碼直載**（`<script type=module>` 無 bundler），esbuild 也不能開箱 bundle。故預打包成單一 vendored ESM bundle。可行性見 [`SPIKE_T0.md`](../../docs/specs/feature/BASE-018_newswire-telegram/SPIKE_T0.md)。

**執行 context（SA §8 定案）**：GramJS 於 **offscreen document** 執行（`dynamic import` 此 bundle）——MV3 service worker 不支援 dynamic import()（Chrome 官方文件確認），且 GramJS 登入需 DOM context。bundle 於 TG2 offscreen 整合時進 `lib/telegram.bundle.js`（比照 `lib/Sortable.min.js`）；在那之前不入 `lib/`（無 code 引用）。

## 重建

```bash
cd tools/telegram-bundle
npm ci          # 鎖定版本安裝(package-lock.json)
npm run build   # → dist/telegram.bundle.js (~2.67 MB min / ~483 KB gzip；gitignored)
npm run verify  # AES 密碼路徑自我檢查(見下)
```

`entry.mjs` 只匯出 `tgClient.js` 需要的 `TelegramClient` / `StringSession` / `NewMessage`。

## Polyfill 配方（`build.mjs`）

teleproto 用帶 `node:` 前綴的 import，故 alias 對 bare 與 `node:` 兩種都映射。

| 類別 | 對應 | 備註 |
|---|---|---|
| 核心密碼 | `crypto`／`node:crypto`→crypto-browserify | teleproto IGE 底層 = aes-256-cbc；`verify.mjs` 驗與 Node 逐位元組一致 |
| alias polyfill | `stream`／`path`／`events`／`util`／`buffer`（＋`node:` 版） | |
| zlib | `zlib`／`node:zlib`→browserify-zlib | teleproto GZIPPacked 解壓（telegram 曾用 pako） |
| assert | `assert`／`node:assert`→assert | browserify-zlib 依賴 |
| functional shim | `os`→`os-shim.cjs` | 建構時讀 `os.type()` 等組 device 字串 |
| 空存根 | `fs`／`net`／`tls`／`socks`／`node-localstorage`→`empty-stub.cjs` | 記憶體 StringSession，不觸檔案/原生 socket |
| inject | `Buffer`(buffer)、`process`(process)；`global=globalThis` | 假設 Node 全域 |

## crypto 自我驗證（`npm run verify`）

AES-IGE 是密碼路徑，換掉 GPL 的 `@cryptography/aes` 後留一個 runnable check（`verify.mjs`）：
1. **crypto-browserify 的 `aes-256-cbc`/`ctr` 與 Node 原生逐位元組一致**——bundle 用此 polyfill，等價成立則 bundle 環境 AES 正確。
2. **teleproto IGE 端到端 round-trip 正確**（IGE = AES-CBC + XOR 邏輯自洽）。

## ⚠️ 授權與維護

**✅ GPL 授權已規避（改用 teleproto）**：上游 `telegram`(GramJS) 強制依賴 `@cryptography/aes` = **GPL-3.0-or-later**（AES-IGE 核心路徑、會被 inline 進 bundle），與本專案 MIT＋CWS 分發衝突。本 recipe 改用 fork **`teleproto`（MIT）**：依賴樹零 GPL/copyleft、無 `@cryptography/aes`，AES-IGE 改用 `node:crypto`（瀏覽器靠 crypto-browserify = MIT polyfill）。`npm run verify` 已驗密碼路徑正確。**一併規避 `telegram` 已 archived 的維護風險。**

**⚠️ 體積 tradeoff**：teleproto bundle **2.67 MB min / 483 KB gzip**（telegram 曾為 1.31M / 383K）。min 翻倍主因 `browserify-zlib` 較重（telegram 用更輕的 pako）；gzip 僅 +100K。因 GramJS 在 offscreen＋tg opt-in（預設 disabled）僅啟用時載入，影響面小，**暫不優化**；若日後要壓，可寫僅 gunzip 的輕量 pako-based zlib shim 取代 browserify-zlib。

供應鏈以 `package-lock.json` 鎖版（137 packages，零 copyleft），納入既有 dependabot。
