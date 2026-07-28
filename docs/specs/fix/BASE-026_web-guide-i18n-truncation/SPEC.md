# BASE-026 — 官網 guide 翻譯值冒號截斷修復（14 語 × 38 keys）

> T1 fix。發現脈絡：v1.19.0 release（#224）撰寫官網文案時盤點所見。

## 背景與問題

`web/locales/*.json`（14 語）中共 **532 筆、38 個 keys** 的值形如 `"<strong>多關鍵字"`——
以 `<strong>` 開頭但無閉合標籤、冒號後的說明文字全部遺失（推測當初翻譯萃取時被全形冒號截斷）。

根因鏈：`web/js/i18n.js` 的 `applyTranslations` 對含 `<` 的值以 `el.innerHTML = translation`
**整個取代**元素內容 → 這些 guide 條目在任何語言（含 zh_TW 自身——其 locale 檔同樣截斷）下
只顯示粗體開頭詞，說明文字全部消失。受影響 keys 全部位於 `web/guide.html`：
guide_{bm,groups,linked_how,reading,rss,search,tabs,theme_bg,window}_li*。

## 方案

- **zh_TW**：以 `guide.html` 的 inline 原文（唯一完整來源）程式化重建，逐字還原。
- **其餘 13 語**：自 zh_TW 原文完整重譯（保留 `<strong>` 標籤結構與 `<kbd>` 範例）。
- 注入沿用 web locale 慣例：JSON round-trip、**逐檔縮排偵測**（de.json 為 4 空格、其餘 2）。
- 排除的替代方案：從截斷值反推補綴（冒號後內容已不存在，無從補）；改 i18n.js 為
  fallback-on-truncation（治標且引入 heuristic，不如修資料）。

## 影響面

- `web/locales/*.json` × 14：532 筆值替換（diff 精確 ±532 行，無其他變動）。
- 新增 `usecase_tests/unit_tests/webLocalesIntegrity.test.mjs`：迴歸防線。
- 與 release PR #224 無 hunk 重疊（該 PR 只在檔尾加新 keys）。
- 無 storage / manifest / 程式邏輯變更。

## Test Impact

- **新增迴歸測試**（jest，納入既有 unit 套件）：(1) 全部 locale 不得存在「含 `<strong>`
  而無 `</strong>`」的值（截斷形態）；(2) 38 個歷史受害 keys 必須存在且長度顯著大於裸標籤。
  未修前 28/28 紅（14 locale × 2 案）、修後全綠——「未修前會 fail」已實證。
- 瀏覽器 smoke：本地 server 載入 guide.html，強制 en 套用翻譯，代表性條目完整渲染
  （含 `<strong>`/`<kbd>` 結構）。
- 驗證指令：`npm run test:unit`。

## 驗收條件

- [x] 14 語 × 38 keys 全數為完整 `<strong>label</strong>：說明` 形態，零截斷殘留。
- [x] zh_TW 與 guide.html inline 原文逐字一致。
- [x] 迴歸測試進 unit 套件（未修前紅、修後綠）。
- [x] 非預設語言於瀏覽器實測條目完整。
