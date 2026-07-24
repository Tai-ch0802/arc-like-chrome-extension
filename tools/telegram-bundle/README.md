# telegram-bundle-builder

`lib/telegram.bundle.js`（GramJS vendored bundle，BASE-018 Telegram 快訊源）的**可重現 build recipe**。這是 build-time 工具，**不屬於擴充功能本體**、不進 `make` 打包。

## 為何 vendored

GramJS（`telegram`）是 CJS 套件、依賴多個 Node built-in（`crypto`/`fs`/`net`/`tls`/`stream`/`path`/`os`/`events`/`util`），**無法以原始碼直載**（`<script type=module>` 無 bundler），esbuild 也不能開箱 bundle。故預打包成單一 vendored ESM bundle。可行性見 [`docs/specs/feature/BASE-018_newswire-telegram/SPIKE_T0.md`](../../docs/specs/feature/BASE-018_newswire-telegram/SPIKE_T0.md)（crypto-browserify sha256 實測與 Node 一致、瀏覽器 WSS transport 連向 Telegram web DC）。

**執行 context（SA §8 定案）**：GramJS 於 **offscreen document** 執行（`dynamic import` 此 bundle）——MV3 service worker 不支援 dynamic import()（Chrome 官方文件確認），且 GramJS 登入需 DOM context。**TG1-live 只落地此 recipe;產出的 1.3M bundle 尚無 code 引用,故不入 `lib/`/不進 main**——TG2 做 offscreen 整合時連同載入 code 一起落地（屆時比照 `lib/Sortable.min.js` 放 `lib/`）。

## 重建

```bash
cd tools/telegram-bundle
npm ci          # 鎖定版本安裝(package-lock.json)
npm run build   # → ../../lib/telegram.bundle.js (~1.3 MB min / ~383 KB gzip)
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

`telegram@2.26.22` 上游**已 archived、不再維護**，開發轉到 fork [`teleproto`](https://npmjs.com/package/teleproto)（宣稱 largely compatible）。目前鎖定 `telegram@2.26.22`；後續安全更新需求時評估遷移到 `teleproto`（見 SA 風險清單）。供應鏈以 `package-lock.json` 鎖版，納入既有 dependabot。
