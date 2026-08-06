# BASE-028: 官網首頁視覺 Redesign(綠色黑底 Geek 風)

- **分級**: T1(視覺層 redesign,不動路由/SEO/i18n key/技術棧)
- **日期**: 2026-08-05
- **方法**: design-taste-frontend + redesign-existing-projects skill,audit-first

## 背景與問題

首頁是 2023 標準 Vercel 模板款:純黑 `#000` 底、accent 為白色(無品牌識別色)、置中 hero、8 個 section 同一種 80px 節奏與同款卡片。不難看,但**沒有記憶點**;「綠色」只是零星裝飾(sync dot)不成系統。另有既有 bug:4 個未定義 CSS 變數導致比較表高亮欄透明、lucide icon 在 i18n 替換後不重繪導致比較表勾叉全空白。

## Design Read 與刻度(使用者已確認)

> Reading this as: 開發者導向 Chrome extension 官網首頁的 redesign-overhaul,for 技術型使用者,with 銳綠 × 黑底的 dark-tech / geek 語言,leaning toward 既有 vanilla CSS 手寫系統 + mono 輔助字體 + 克制的 CSS 動效。

- `DESIGN_VARIANCE 7 / MOTION_INTENSITY 6 / VISUAL_DENSITY 4`(使用者選「更大膽」)
- 唯一 accent:**`#00dc82`** 銳綠,全站鎖定一色;底色 off-black `#050807`(帶微綠底調)
- 字體:**Geist + Geist Mono**(Google Fonts);CJK 走系統 fallback(PingFang TC 等),CJK 語系標題字距歸零

## 設計決策摘要

| 區塊 | 改動 | 佈局家族 |
|---|---|---|
| Token | `:root` 全換綠系;補 4 個未定義變數(`--accent-color` 等);radius 收斂 6/10/16;container 1100→1180 | - |
| Navbar | 純 CSS 換色;新增 skip-link 與全站 `:focus-visible` 綠 ring | - |
| Hero | 置中 → 左對齊;carousel 右緣出血(≥1240px);刪 trust-signals(AI tell);`.text-gradient` 改白→綠漸層(class 名保留,28 條翻譯引用);入場 stagger 動畫 | offset hero + 出血 |
| Philosophy | header 左對齊;th 改 mono 大寫小字;「我們」欄綠高亮自動復活(變數修復);wrapper 去 hover 浮起 | 全寬資料表 |
| Features | bento 結構不動;AI signature 動畫(messy→sorted wipe + scanner)保留、紫→綠;ws 靛→綠 | bento |
| More Features | 7 張直排 → lead(Spotlight 全寬)+ 2 欄 grid(1+6,零空格) | lead + 2col grid |
| AI Setup | 5 張 3 欄卡(破格留白)→ 垂直 timeline:連續綠 hairline + mono 數字圈;`code` 全站改 mono 終端綠 | vertical timeline |
| Privacy | split 保留(全頁唯一);shield 由近隱形改綠 + drop-shadow | split |
| 圖片 | 2752px JPEG(4.3MB)→ 1800px WebP(370KB);補 width/height/fetchpriority/lazy | - |

佈局家族 6 種、eyebrow 總數 1(hero badge-pill)、zigzag 0、marquee 0、scroll cue 0、em-dash 新增 0。

### 後續修正(#233 合併後)

hero 的「右出血」初版沒有上界,寬度隨視窗線性成長(2560 螢幕上 1822×1025,mockup 佔螢幕高 71~83%)。改為 `min()` 三重上限:出血量、1240px 絕對寬(素材 1800px,再大只是變糊)、`68svh` 換算 16/9 的寬度(用 `svh` 不用 `dvh`,避免手機橫向網址列收合造成捲動中重排)。設計語彙由「出血到視窗邊緣」調整為「有界的 overhang」— 超寬螢幕上真正的邊緣出血必然使 16/9 素材高過視窗,兩者不可兼得。

同時修正 `.glow-blur`:它是 `position: absolute` 且 containing block 為 viewport,`html` 的 `overflow-x: clip` 裁不到它,375px 下實測可右拖 113px。改為 `width: min(600px, 100%)` 自我設限。

## 不變的契約

- 路由、anchor id(`#philosophy` `#features` `#ai-setup` `#privacy`)、SEO meta / JSON-LD / OG、`sitemap.xml`
- 全部 14 個 locale 檔與 `data-i18n` key;翻譯值內嵌的 `.text-gradient`(28 條)與 lucide icon 標籤(210 條)
- Hero 區 inline 英文文案(OAuth 審查靜態畫面,commit `6a5e05d`)
- `main.js:9` scroll-reveal 選擇器與 `analytics.js` 的 `.hero-actions`/`nav`/`footer` 依賴 class
- 技術棧:vanilla CSS/JS、無框架無 build;`Makefile` 不含 web/,不需動打包

## 附帶修復(root cause)

1. `--accent-color` / `--accent-color-rgb` / `--accent-glow` / `--accent-light` 於 `:root` 定義 → 比較表高亮與 carousel active dot 復活。
2. `i18n.js` `applyTranslations()` 末補 `lucide.createIcons()` → 所有語言下 innerHTML 替換後 icon 重繪(比較表 15 格勾叉)。
3. `i18n.js` 自動偵測路徑補設 `document.documentElement.lang` → `:lang()` CJK 字距修正得以生效(原本只有手動切換才設)。
4. LCP:hero 圖 fetchpriority=high + WebP;非首屏圖 lazy;全部補 width/height 防 CLS。

## 爆炸半徑(子頁)

grep 實證:`features-list` / `setup-steps` / `step-card` / `comparison-table` / `feature-item` / `bento` / `hero-visual` / `mockup` 均為首頁獨有。子頁共用 `navbar` / `btn*` / `badge*` / `footer-*` / `container` / `glow-*` / `lang-switcher-*` / `section-title`,吃到新綠 token 屬預期的品牌一致化(佈局類屬性未動)。子頁各自 inline `<style>` 內殘留紫/藍舊色 → 範圍外,follow-up 候選。

## 驗證

- `npx jest usecase_tests/unit_tests/webLocalesIntegrity.test.mjs`(不動 locale,應全綠)
- 新增可見文字 grep 零 em-dash(meta description 既有「—」為 SEO 凍結內容,不動)
- 本機 server + Chrome 手動:1440/900/375 三檔寬、hero 首屏 CTA 可見、Tab 鍵盤走訪(skip-link + 綠 focus ring)、CTA 對比(綠底黑字 ~10:1)、`prefers-reduced-motion` 模擬全靜止、切 zh_TW/ja 比較表 icon 與綠高亮渲染、子頁 smoke check
