# telegram-bundle-builder

Telegram 快訊源（BASE-018）GramJS 客戶端的 **vendored bundle 可重現 build recipe**。底層用 **[`teleproto`](https://github.com/sanyok12345/teleproto)**（MIT，telegram/GramJS 的官方接班 fork——見下方「授權與維護」）。build-time 工具，**不屬於擴充功能本體**、不進 `make` 打包。

`npm run build` 輸出到 `dist/`（gitignored）。committed 的 `lib/telegram.bundle.js` 由維護者從 `dist/` **受控複製**（`cp dist/telegram.bundle.js ../../lib/`）——刻意分離「重建驗證」與「更新 committed bundle」：`make` 從檔案系統整包 cp `lib/`，若讓 build 直接寫 `lib/`，任何人跑重建就會覆蓋 committed bundle。

## 為何 vendored

teleproto 是 CJS 套件、依賴多個 Node built-in（`crypto`/`zlib`/`stream`/`path`/`os`/…），**無法以原始碼直載**（`<script type=module>` 無 bundler），esbuild 也不能開箱 bundle。故預打包成單一 vendored ESM bundle。可行性見 [`SPIKE_T0.md`](../../docs/specs/feature/BASE-018_newswire-telegram/SPIKE_T0.md)。

**執行 context（SA §8 定案）**：GramJS 於 **offscreen document** 執行（`dynamic import` 此 bundle）——MV3 service worker 不支援 dynamic import()（Chrome 官方文件確認），且 GramJS 登入需 DOM context。bundle 已隨 TG2b 進 `lib/telegram.bundle.js`（比照 `lib/Sortable.min.js`），只在 tg 啟用時於 offscreen 載入。

## 重建

```bash
cd tools/telegram-bundle
npm ci          # 鎖定版本安裝(package-lock.json)
npm run build   # → dist/telegram.bundle.js (~2.63 MB min / ~470 KB gzip；gitignored)
npm run verify  # AES 密碼路徑自我檢查(見下)
npm run audit   # 供應鏈紅旗 gate(teleproto 升版必跑,見下)
# 確認無誤後更新 committed bundle：
cp dist/telegram.bundle.js ../../lib/telegram.bundle.js
```

`entry.mjs` 只匯出 `tgClient.js` 需要的 `TelegramClient` / `StringSession` / `NewMessage`。

## Polyfill 配方（`build.mjs`）

teleproto 用帶 `node:` 前綴的 import，故 alias 對 bare 與 `node:` 兩種都映射。

| 類別 | 對應 | 備註 |
|---|---|---|
| 核心密碼 | `crypto`／`node:crypto`→crypto-browserify | teleproto IGE 底層 = aes-256-cbc；`verify.mjs` 驗與 Node 逐位元組一致 |
| alias polyfill | `stream`／`path`／`events`／`util`／`buffer`（＋`node:` 版） | |
| zlib | `zlib`／`node:zlib`→`zlib-shim.cjs`（pako） | teleproto GZIPPacked 只用 `unzipSync`；薄 shim 取代 browserify-zlib（+8 transitive），供應鏈更小 |
| functional shim | `os`→`os-shim.cjs` | 建構時讀 `os.type()` 等組 device 字串 |
| 空存根 | `fs`／`net`／`tls`／`socks`／`node-localstorage`→`empty-stub.cjs` | 記憶體 StringSession，不觸檔案/原生 socket |
| inject | `Buffer`(buffer)、`process`(process)；`global=globalThis` | 假設 Node 全域 |

## crypto 自我驗證（`npm run verify`）

AES-IGE 是密碼路徑，換掉 GPL 的 `@cryptography/aes` 後留 runnable check（`verify.mjs`）：
1. **crypto-browserify 的 `aes-256-cbc`/`ctr` 與 Node 原生逐位元組一致**——bundle 用此 polyfill，等價成立則 bundle 環境 AES 正確。
2. **teleproto IGE 端到端 round-trip**。
3. **teleproto IGE == 獨立 textbook AES-256-IGE**（用 `aes-256-ecb` 依 MTProto 定義自建 oracle，200 組隨機逐位元組）——不依賴 teleproto 自身，排除 IGE 被弱化/植入後門。

## 供應鏈紅旗 gate（`npm run audit`）

`audit.mjs` 是 teleproto **升版時必跑**的低誤報硬 gate（不取代人工稽核，見下）：teleproto 有無 install 掛鉤、eval/混淆、依賴樹是否引入 copyleft；並列出 teleproto source 出現的外連網域供人工複核。

## ⚠️ 授權與維護

**✅ GPL 授權已規避（改用 teleproto）**：上游 `telegram`(GramJS) 強制依賴 `@cryptography/aes` = **GPL-3.0-or-later**（AES-IGE 核心路徑、會被 inline 進 bundle），與本專案 MIT＋CWS 分發衝突。本 recipe 改用 fork **`teleproto`（MIT）**：依賴樹零 GPL/copyleft、無 `@cryptography/aes`，AES-IGE 改用 `node:crypto`（瀏覽器靠 crypto-browserify = MIT polyfill）。

**✅ 供應鏈可信度評估（2026-07-24，接 runtime 前）**：稽核**實際 npm tarball**（非 GitHub source）——密碼核心 diff vs GramJS 上游：`RSA.js`/`Factorizator.js` byte-identical、DH 交換安全檢查全保留、PBKDF2 未弱化（iter=100000/SHA-512）、DC IP 為官方、session 不外送、**AES-IGE 對獨立實作 1000+ 組測試 0 失敗**；紅旗全清（無可疑外連/eval/混淆/資料外洩/telemetry/install 掛鉤）。**原作者 painor 經 npm+GitHub 雙管道正式接班背書**。評級 **有條件可信**。殘留風險 bus factor=1 → 對策：**pin `1.228.4` + lockfile integrity + 每次升版必跑 `npm run verify && npm run audit`**（本 recipe 已內建此 gate）。一併規避 `telegram` 已 archived 的維護風險。

**⚠️ 體積**：bundle **2.63 MB min / 470 KB gzip**（telegram 曾為 1.31M/383K）。主因是 **teleproto core（~3M 原始碼，硬體積、壓不掉）** 與 crypto-browserify（RSA/DH 全套 ~780K）；zlib 換 pako shim 只省 ~40K。已評估不再優化（壓不回 1.3M，且 crypto shim 需動已驗證的密碼路徑）——因 GramJS 在 offscreen＋tg opt-in（預設 disabled）僅啟用時載入，影響面小。

供應鏈以 `package-lock.json` 鎖版（131 packages，零 copyleft），納入既有 dependabot。
