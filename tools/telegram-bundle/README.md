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

**🔴 授權 blocker（TG2 落地前必須解決）**：`telegram` 的 MTProto AES-IGE 加密實作**強制依賴** `@cryptography/aes@0.1.1`，授權為 **GPL-3.0-or-later**（強 copyleft）。本專案是 **MIT** 且透過 Chrome Web Store 分發。一旦把此 bundle vendored 進 `lib/`，等於在 MIT／閉源分發的擴充功能內嵌 GPL-3.0 程式碼——授權相容性衝突。且它在**核心密碼路徑**，`build.mjs` 無法 stub；WebCrypto 也不支援 AES-IGE 這個非標準模式，不易直接替換。TG2 落地前須先解決：評估替換加密實作、或改採其他方案。**這可能牽動整個 GramJS 路線可行性。**

**telegram 已 archived**：`telegram@2.26.22` 上游已 archived、不再維護，開發轉到 fork [`teleproto`](https://npmjs.com/package/teleproto)（宣稱 largely compatible）。目前鎖定 `telegram@2.26.22`；評估遷移 `teleproto` 時**一併確認它是否仍依賴同一個 GPL 加密庫**。供應鏈以 `package-lock.json` 鎖版，納入既有 dependabot。
