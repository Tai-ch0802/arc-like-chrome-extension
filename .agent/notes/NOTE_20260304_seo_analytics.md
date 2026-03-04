# 開發摘要 - 2026-03-04 (Part 2)

## 變更項目
- `web/workona.html`, `web/toby.html`, `web/vertical-tabs.html`: 新增三個競品對比的靜態 HTML SEO 落地頁，包含專屬客製化的功能比較表、FAQ 以及清爽的 Navbar 與 Hero 區塊。
- `web/js/analytics.js`: 新增並設定 Google Analytics 4 (G-X64RWB40SB) 追蹤分析功能，並埋設「加到 Chrome」等點擊事件追蹤。
- `web/index.html`: 首頁下方新增指向 `workona`, `toby`, `vertical-tabs` 競品網頁的反向連結，增強網站內部 SEO 權重流動。套入新的 GA4 script。
- `web/locales/*.json` (14國語言): 完整補齊新建立的 Programmatic SEO 與替代品導覽區塊的所有多語系支援內容，包含英、繁中、簡中、日、韓、德、法、西、俄、印地、印尼、泰、越南與葡萄牙語。
- `web/sitemap.xml`: 新增三個靜態頁面的 URL 至 sitemap，加速 Googlebot 收錄與索引。
- `web/guide.html`, `web/changelog.html`, `web/privacy.html`: 注入了 `analytics.js` 來達成全站流量分析。

## 技術決策
- **靜態網頁取代動態生成腳本 (Programmatic SEO)**：為了保證 Google SEO 爬蟲在沒有執行 JavaScript 情況下依然能抓取到 `<H1>`、比較表與精準的多語系關鍵字，我們採用複製相同的全靜態 `index.html` 基礎佈局策略，將這些特定文字寫在 HTML `data-i18n` 中並採用「繁體中文」為原生 fallback 預設值，完美防範因為腳本或網路載入太慢造成的 `undefined` 失誤。
- **資料保護聲明 (Analytics)**：由於使用 GA4 追蹤，所以在我們既有的 `privacy.html` 配合了最新的分析透明性。
- **UI 調整**：移除了底部會破版的重複 CTA Hero 區塊，並重新繪製 `H1` 標題的專屬淺色漸層渲染 (`#fff` 到 `#67e8f9`) 解決在深色背景看不見的問題。

## 待辦事項
- [ ] 後續觀察 GA4 在 Chrome Web Store 與落地頁之間的 Event 流失率 (Drop-off Rate)。
- [ ] 可以考慮後續新增如 Session Buddy 或 OneTab 專屬的備份比較 landing page。
