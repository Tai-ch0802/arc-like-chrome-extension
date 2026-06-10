# [Fix/T1] M3 主題與無障礙修正（#162 WP5：C1~C6）

## 背景與問題

- **C1 [High，Puppeteer 實證]**：四個 color-mix tokens（state-layer ×3、focus-ring）宣告在 `:root`，但主題（內建 `data-theme` 與自訂變數）套在 `body`。CSS custom property 中的 `var()` 在**宣告元素**上即完成替換 → tokens 永遠以 :root 的 GEEK 預設值解析，所有非預設主題的 focus ring 都是 GEEK 綠。
- **C2 [Med]**：pressed state layer（`:active` 設 `background-color`）被後出的同特異性 `:hover` 規則蓋掉 —— 滑鼠按下必同時 hover，pressed 回饋從未渲染。
- **C3 [Med]**：Other-Windows 資料夾展開狀態雙機制衝突 —— renderer 用 inline `style.display`、searchManager 用 `.collapsed` class：搜尋命中時 chevron/aria 顯示展開但內容仍隱藏（class 蓋不過 inline style）。
- **C4 [Low-Med]**：`data-i18n-title` 無任何處理迴圈，6 個元素的 tooltip 永遠空白或硬編碼英文（14 語系皆然）。
- **C5 [Low]**：新建的「展開」group header 缺初始 `aria-expanded`/`dataset.collapsed`（update 路徑只在狀態變化時寫入）。
- **C6 [Low]**：`renderIcon` 未知 id 靜默回空字串（`renderIconEl` 卻 fallback 'language'）—— 動態 id 呼叫端打錯字會渲染出隱形按鈕。

## 方案

1. **C1**：四個 color-mix tokens 移到 `body { }` 區塊宣告（主題所在元素），`:root` 留註解指路。
2. **C2**：`:active` 改寫 `background-image: linear-gradient(token, token)` —— 與 hover 的 `background-color` 不同屬性，直接複合疊加，無特異性競賽。
3. **C3**：searchManager 的 window-folder 分支改用 inline `style.display`（與 renderer、與 group 分支同機制）；chevron/aria 行為不變。
4. **C4**：`applyStaticTranslations` 新增 `[data-i18n-title]` 迴圈：設 `title`，icon-only 缺 `aria-label` 時一併補。
5. **C5**：group header 建立時即寫齊 `aria-expanded`/`dataset.collapsed`/chevron class。
6. **C6**：`renderIcon` 未知 id → `console.warn` + fallback `'language'`（與 `renderIconEl` 一致）。

## 影響面

`sidepanel.css`（tokens 位置、pressed 疊層）、`modules/searchManager.js`、`sidepanel.js`（i18n-title 迴圈）、`modules/ui/tabRenderer.js`、`modules/icons.js`。無 storage / manifest 變更；i18n 僅「使用既有 key」，無新 key。

## Test Impact

- `happy_path_theme_switch.test.js` 新增 **C1 迴歸斷言**：切到 google 主題後，`getComputedStyle(body).getPropertyValue('--arc-focus-ring')` 內含 `#1a73e8`、不含 GEEK 綠 `#00ff41`。
- 其餘為視覺/語意修正，由既有 E2E 全套守護。

## 驗收條件

- [ ] 非預設主題下 focus ring 跟隨主題 accent（E2E 斷言）。
- [ ] 按下任一列/按鈕可見 pressed 疊層（與 hover 複合）。
- [ ] 搜尋命中 Other-Windows 資料夾時內容真的展開；清除搜尋後 chevron 與內容一致。
- [ ] 6 個 `data-i18n-title` 元素在非英文語系顯示在地化 tooltip。
- [ ] 新建展開態 group header 即有 `aria-expanded="true"`。
- [ ] unit + happy_path E2E 全綠。
