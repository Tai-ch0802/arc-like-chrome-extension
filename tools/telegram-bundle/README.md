# telegram-bundle-builder

GramJS vendored bundle（BASE-018 Telegram 快訊源；TG2 落地為 `lib/telegram.bundle.js`）的**可重現 build recipe**。這是 build-time 工具，**不屬於擴充功能本體**、不進 `make` 打包。build 產物輸出到 `dist/`（gitignored，**刻意不落在 `lib/`**——`make` 從檔案系統整包 cp `lib/`，輸出那裡會讓任何人跑重建就把 1.3M 打進包）。

## 為何 vendored

GramJS（`telegram`）是 CJS 套件、依賴多個 Node built-in（`crypto`/`fs`/`net`/`tls`/`stream`/`path`/`os`/`events`/`util`），**無法以原始碼直載**（`<script type=module>` 無 bundler），esbuild 也不能開箱 bundle。故預打包成單一 vendored ESM bundle。可行性見 [`docs/specs/feature/BASE-018_newswire-telegram/SPIKE_T0.md`](../../docs/specs/feature/BASE-018_newswire-telegram/SPIKE_T0.md)（crypto-browserify sha256 實測與 Node 一致、瀏覽器 WSS transport 連向 Telegram web DC）。

**執行 context（SA §8 定案）**：GramJS 於 **offscreen document** 執行（`dynamic import` 此 bundle）——MV3 service worker 不支援 dynamic import()（Chrome 官方文件確認），且 GramJS 登入需 DOM context。**TG1-live 只落地此 recipe;產出的 1.3M bundle 尚無 code 引用,故不入 `lib/`/不進 main**——TG2 做 offscreen 整合時連同載入 code 一起落地（屆時比照 `lib/Sortable.min.js` 放 `lib/`）。

## 重建

```bash
cd tools/telegram-bundle
npm ci          # 鎖定版本安裝(package-lock.json)
npm run build   # → dist/telegram.bundle.js (~1.3 MB min / ~383 KB gzip；gitignored)
```

`entry.mjs` 只匯出 `tgClient.js` 需要的 `TelegramClient` / `StringSession` / `NewMessage`。

## Polyfill 配方（`build.mjs`）

| 類別 | 對應 | 備註 |
|---|---|---|
| alias polyfill | `crypto→crypto-browserify`（**核心密碼路徑,不可省**）、`stream`/`path`/`events`/`util` | spike 已驗 sha256 與 Node 一致 |
| functional shim | `os→os-shim.cjs` | 建構時讀 `os.type()` 等組 device 字串 |
| 空存根 | `fs`/`net`/`tls`/`socks`/`node-localstorage→empty-stub.cjs` | 記憶體 StringSession,不觸檔案/原生 socket |
| inject | `Buffer`(buffer)、`process`(process)；`global=globalThis` | GramJS 假設 Node 全域 |

## ⚠️ 維護警示

**🟠 授權 blocker（有解方，TG2 執行）**：`telegram` 的 MTProto AES-IGE 加密**強制依賴** `@cryptography/aes@0.1.1` = **GPL-3.0-or-later**（純 JS `dist/cjs/aes.min.js`，會被 esbuild inline 進 bundle）。本專案 MIT＋CWS 分發，內嵌 GPL-3.0 = 授權衝突；它在核心密碼路徑無法 stub，WebCrypto 也無 AES-IGE（非標準模式）。

**✅ 解方已查證（2026-07-24）：遷 fork [`teleproto`](https://github.com/sanyok12345/teleproto)（MIT）**。實測 `npm install teleproto` 掃描：依賴樹 12 packages **零 GPL/copyleft、無 `@cryptography/aes`**；AES-IGE 改用 Node `node:crypto` 的 `createCipheriv("aes-256-cbc"/"AES-256-CTR")` 手工組（瀏覽器端靠 `crypto-browserify` = MIT polyfill）。目錄/API 與 GramJS 對齊（`TelegramClient`／`sessions/StringSession`／`events/NewMessage` 皆在），`entry.mjs` 幾乎只需把 `telegram` 換成 `teleproto`。**此遷移一併解掉 `telegram` 已 archived 的維護風險。**

**TG2 遷移待辦**：`entry.mjs` 改 `teleproto`；`build.mjs` alias 補 `node:crypto → crypto-browserify`（teleproto 有 7 檔用帶 `node:` 前綴的 import，現有 alias 只匹配 `crypto`）；重驗瀏覽器端 `createCipheriv` aes-256-cbc/ctr 正確性（IGE 依賴 CBC）；確認「largely compatible」的實際 API 差異。供應鏈以 `package-lock.json` 鎖版，納入既有 dependabot。
