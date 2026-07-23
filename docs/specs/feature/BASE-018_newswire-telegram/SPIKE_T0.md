# BASE-018 T0 Spike 結果（GramJS 可行性）

> 日期：2026-07-23｜spike 程式碼為 scratch（不入版控，位於本機 scratchpad）；本文為結論回填。
> GramJS 版本：`telegram@2.26.22`（runtime 自報 2.26.21，minor 內部標記差，無害）。

## 一句話結論

**PROCEED（有條件）**：GramJS 可在 extension 內運作——bundle 可產出、client 可建構、**核心密碼路徑（crypto-browserify）在瀏覽器實測正確**、瀏覽器 WSS transport 會選中並嘗試連 Telegram 官方 web 端點。但有明確整合成本（需 polyfill build＋vendored bundle、1.3M 體積、dev 模式需預打包），且**真實登入與訊息接收無法由我驗證**（需你的 api_id/api_hash＋手機），已備妥 harness 供你完成。

## 四個問題逐一結論

### Q1：GramJS 在 MV3 SW 實連 — ⚠️ 部分 PASS（可驗部分全過）

| 項目 | 結果 |
|---|---|
| bundle 於瀏覽器載入 | ✅ |
| `TelegramClient`＋`StringSession` 建構（無 Node API 崩潰） | ✅ |
| **核心 crypto**（`generateRandomBytes`＋`sha256`，經 CryptoFile→crypto-browserify） | ✅ `sha256('hello')` = `2cf24dba…938b9824`，與 Node `crypto` **完全一致** |
| 瀏覽器 WSS transport 選擇＋WebSocket 連線嘗試 | ✅ console 實測：連向 `vesta.web.telegram.org:443/xw`（Telegram 官方 web DC）——**用的是瀏覽器原生 WebSocket，非 Node net/tls** |
| 完整 auth-key 握手完成 | ⛔ 在 in-app 瀏覽器 sandbox 下 `Error: TIMEOUT`（限外連＋無真憑證）；**非 Node-API 崩潰** |
| 真登入＋真 `NewMessage` 接收 | 🧑 **需你跑 harness**（我無 api_id/api_hash、且輸入憑證/認證是我被禁止的動作） |

> SW context 註記：以上在 DOM/page context 實測。SW 建構等價（GramJS 建構不碰 DOM、crypto-browserify 純 JS、WebSocket 於 SW Chrome 116+ 可用），但**真實 SW 連線列入手動矩陣**。

### Q2：bundle 體積 + esbuild 相容性 — ✅ PASS（有條件）

- **體積**：1.3 MB minified / **383 KB gzip**（在 SA 的 < 2MB 目標內）。
- **不能開箱即用**：GramJS 是 CJS＋依賴多個 Node built-in，esbuild `--platform=browser` 直接 bundle 會炸（`crypto`/`fs`/`net`/`tls`/`path`/`os`/`events`/`util`）。GramJS 官方 browser 方案是 **webpack＋polyfill**。本 repo（esbuild）需一個**專屬 polyfill build step**：
  - alias polyfill：`crypto→crypto-browserify`（**在核心路徑，不可省**）、`stream→stream-browserify`、`path→path-browserify`、`events→events`、`util→util`
  - functional shim：`os→` 提供 `type()/release()/platform()` 的 shim（建構時讀 os 組 device 字串，空存根會 `os.type is not a function`）
  - 空存根：`fs`/`net`/`tls`/`socks`/`node-localstorage`（用 StringSession 記憶體 session，不走 node-localstorage）
  - inject：`Buffer`（buffer 套件）、`process`（process 套件）；define `global=globalThis`
- **依賴膨脹**：安裝 46 → 加 polyfill 後 build 依賴 ~86 packages（供應鏈與 audit 面積擴大，納入既有 dependabot）。

### Q2b：`make` dev 模式載入方案 — ⚠️ 需預打包

repo dev 模式（`make`）把 `modules/*.js` 當**原始碼**直載（`<script type=module>`，無 bundler）。GramJS 是 CJS＋Node 依賴，**無法以原始碼直載**。→ **必須把 GramJS 預打包一次成 vendored bundle 放 `lib/`**（比照 `lib/Sortable.min.js`），以全域方式匯入，**不走 from-source esbuild 路徑**。此為既有先例、乾淨模式。

### Q3：options 頁登入流程 — 🧑 harness 已備（真跑需你）

- 登入流程（phone → code →（2FA）password）＝ GramJS 標準 `client.start`，在瀏覽器可建構/啟動。
- **options→SW 交棒設計**：options 頁跑 `client.start`（互動、需 prompt 輸驗證碼）→ 取 `session.save()` 字串 → 寫入 `newswireKeys.tg`（storage.local）→ SW 的 tgAdapter 以該 StringSession 字串建構。**從 session 字串建構已驗證可行**（空 session round-trip OK）。
- Harness：`scratchpad/tg-spike/harness.html`＋`harness-bundle.js`（你填自己的 api_id/api_hash/手機，完成真登入並訂 @BWEnews 驗證 NewMessage）。

### Q4：keepalive/watchdog 相容性 — ✅ 設計相容

- GramJS 內建 ping loop（`_updateLoop` 定期送 WS 流量）→ 重置 SW idle timer，與既有 keepalive 相容。
- SW 仍可能被回收 → 既有 `newswireWatchdog` alarm（30s）對 dead adapter 重連（tgAdapter 實作同一 `Adapter` 介面）。
- session 持久化於 storage.local → SW 重啟後以 session 字串重建（已驗證建構自字串可行）。

## 風險與待你確認

1. **1.3M bundle** 是可觀的體積增量——CWS 送審與載入成本需接受。
2. **真連線/登入/接收** 我無法驗（無憑證＋認證屬禁止動作）→ 你跑 harness 確認；正式實作的真 SW 連線列入手動矩陣。
3. in-app 瀏覽器 sandbox 下連線 TIMEOUT——正式擴充有 `host_permissions: *://*/*`，預期無 CSP/權限阻擋，但 **SW→vesta.web.telegram.org 的實連需在手動矩陣確認**。
4. crypto-browserify＋polyfill 一批新依賴——供應鏈面積，鎖版本＋dependabot。

## 建議

可行性已充分 de-risk，**建議進 SA 定稿 → TG1**，前提是你跑 harness 確認真登入＋接收（我唯一無法代驗的一環）。若 1.3M 體積不可接受，則需重新評估（備援仍為 SA §7 的 Telethon 桌面＋本機橋接，體驗較差）。

## 附：spike 產物位置（scratch，不入版控）

`scratchpad/tg-spike/`：`build.mjs`（esbuild polyfill 設定，即上方 Q2 清單）、`bundle_poly.js`（建構＋crypto＋連線探測）、`harness.html`＋`harness-bundle.js`（你的登入驗證）、`os-shim.cjs`、`empty-stub.cjs`、`shim-inject.js`。
