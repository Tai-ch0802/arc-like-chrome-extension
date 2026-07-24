# BASE-019 — 快訊 options 頁:資訊源卡片收折 + 區塊標題視覺層級

## 背景與問題

1. **資訊源卡片全展開太凌亂**:快訊 section 有五張源卡(Tree/FJ/Alpaca/金十/Telegram)，每張都常駐展開(enable toggle、key 欄位、申請引導、金十另有分段多選)，整頁一眼掃不到重點。日常使用者只需要看「哪些源開著、連線狀態如何」，設定欄位是一次性操作。
2. **區塊標題視覺層級倒置**:`h4.settings-subsection-header`(資訊源/關鍵字規則/通知/跨裝置同步)原為 12px/600/`--text-color-secondary`，反而比其「內容」的 `.opt-row__label`(14px/`--text-color-primary`)不顯眼，區塊切分讀不出來。

## 方案

1. **收折卡片**(`options.js`):新增 `buildCollapsibleCard(cardEl, title, statusEl, expanded)` helper——標題列改為 `<button class="opt-row newswire-card-toggle" aria-expanded>`（品牌名 + 狀態徽章），內容集中到 `.newswire-card-body`，點標題切換 `hidden` class 並同步 `aria-expanded`。
   - **預設全部收合**;狀態徽章留在標題列，收合時仍一眼可見連線狀態(disabled/needs-key/connected…)。
   - **收折狀態不持久化**(不新增 storage key，YAGNI;session 內互動即可)。
   - 四源卡(主迴圈)與 Telegram 卡(`renderTgCard`)共用同一 helper;tg 卡的 `repaint()`(登入/登出/增刪頻道後重繪)以重繪前的 `aria-expanded` 保留展開態，避免操作中卡片突然收合。
   - 原生 `<button>` 取得免費的鍵盤操作與 focus ring;chevron 為 CSS `::before` 裝飾(`aria-expanded` + `aria-controls`→body id 承載完整 disclosure pattern 語意)，無新增 i18n 字串。
2. **標題層級**(`sidepanel.css` 共用 class，一處修全站):`.settings-subsection-header` 12px→14px、600→700、secondary→primary。整個 options 頁所有 subsection 標題(含外觀/同步/AI 等區塊)一致受益——層級問題是共用樣式造成，修在共用點而非只覆寫快訊區。
   - 排除方案:只對快訊區加 override class——同樣的層級倒置在其他區塊一樣存在，區域覆寫會留下不一致。

## 影響面

- `options.js`:`buildCollapsibleCard` helper、四源卡迴圈內容改掛 body、`renderTgCard` 重構(外層 `card` + body 沿用 `group` 名稱，paint 函式呼叫點零改動)。
- `options.css`:`.newswire-card-toggle`(button reset + 展開時 border-bottom)、chevron `::before`(含 `prefers-reduced-motion` 停用轉場)。
- `sidepanel.css`:`.settings-subsection-header` 三屬性調整(全 options 頁生效;sidepanel 本身無此 class 使用點，經 grep 確認)。
- 無 storage / manifest / 跨 context 協定變更;無新增 i18n 字串。

## Test Impact

- `usecase_tests/puppeteer_tests/happy_path_newswire_options.test.js`:
  - 新增斷言:卡片預設收合(body 有 `hidden`、toggle `aria-expanded=false`)、狀態徽章位於標題列。
  - FJ enable 與金十分段兩個測試:點擊前先點 toggle 展開、`waitForSelector {visible:true}` 等實際可見(收合後 `page.click` 對不可見元素會失敗)。
- 驗證指令:`npx jest usecase_tests/puppeteer_tests/happy_path_newswire_options.test.js usecase_tests/puppeteer_tests/happy_path_options_page.test.js usecase_tests/puppeteer_tests/accessibility_checks.test.js`

## 驗收條件

- [x] 快訊頁載入時五張源卡全收合，僅顯示「▸ 名稱 + 狀態徽章」一列
- [x] 點標題展開/再點收合;`aria-expanded` 同步;鍵盤(Tab+Enter)可操作(原生 button)
- [x] 收合狀態下狀態徽章仍即時反映 newswire:status 廣播
- [x] tg 卡登入/增刪頻道觸發 repaint 後維持展開
- [x] 資訊源/關鍵字規則/通知/跨裝置同步標題視覺上明顯強於 `.opt-row__label`
- [x] 上列三個 E2E 測試套件全數通過(9+7 tests)
