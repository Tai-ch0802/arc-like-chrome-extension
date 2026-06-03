---
name: web-design-guidelines
description: 依 Vercel Web Interface Guidelines 審查本專案 sidepanel UI 程式碼。對 sidepanel 窄寬度 (~300-400px)、scrollable 列表、Chrome theme 配色、鍵盤導航、aria 標籤特別關注。當使用者提到「審查 UI、check accessibility、audit design、review UX、檢查無障礙、檢查設計、UI review」時觸發。
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

依 Vercel Web Interface Guidelines 審查本專案的 UI 程式碼，並以本 Chrome extension sidepanel 的場景做額外加強。

## How It Works

1. 從以下來源抓取最新 guidelines
2. 讀取使用者指定的檔案（或詢問檔案 / pattern）
3. 對照所有規則 + 本專案 sidepanel-specific 注意事項
4. 以 `file:line` 簡明格式輸出問題

## Guidelines Source

每次審查前 fetch 最新版：

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

用 WebFetch 抓取，回傳內容含完整規則與輸出格式說明。

## Usage

使用者給檔案或 pattern：
1. 從上方 URL 抓 guidelines
2. Read 指定檔案
3. 套用 guidelines 內所有規則 + 下方 sidepanel-specific 加強檢查
4. 依 guidelines 規定的格式輸出

若未指定檔案，詢問要審哪些。

## 本專案 Sidepanel-Specific 加強檢查

通用 Web Interface Guidelines 沒涵蓋的 Chrome extension sidepanel 特殊情境：

### Layout & Density
- **寬度約束**：sidepanel 預設 ~320px，使用者可拖到 ~700px。所有 layout 不可預設 desktop 寬度。檢查是否有 hardcoded `width: 800px` 之類；改用 `max-width` 或彈性布局。
- **垂直 scroll 是主互動**：列表項目間距不宜過大；`flex-shrink-0` 避免 header / footer 被擠。
- **避免水平 scroll**：長文字用 `text-overflow: ellipsis`、`word-break: break-word`、`min-width: 0` 處理。

### Chrome Theme 整合
- **繼承 Chrome theme 配色**：sidepanel 應透過 `chrome.theme` API 或 CSS 變數讀系統 dark mode（`prefers-color-scheme`）。檢查是否硬編碼 `#fff` / `#000`。
- **自訂主題不可破壞無障礙**：`modules/ui/customThemeManager.js` 提供自訂配色，但須通過 `modules/utils/colorUtils.js` 的 WCAG 4.5:1 對比度檢查（refs `image-master` skill）。

### Keyboard Navigation（sidepanel 重點）
- **Tab order**：分頁、書籤、閱讀清單、設定按鈕的 tab 順序須符合視覺順序。
- **Focus ring**：純圖示按鈕（`modules/icons.js` 的 SVG）必須有 `:focus-visible` 樣式。
- **Drag-drop 替代方案**：拖曳分頁 / 書籤的 SortableJS 操作須有鍵盤替代方式（上下方向鍵 + Enter 確認）或至少 ARIA 提示。

### ARIA / Semantics
- **純圖示按鈕**：必須有 `aria-label`，並建議加 `title` 提供 tooltip（沿用 AGENTS.md "Memory Tips" 規範）。
- **動態列表 announcement**：書籤展開 / 閱讀清單新增 / Toast 訊息應使用 `aria-live="polite"` 區域。
- **Modal**：`modules/modalManager.js` 的 prompt / confirm dialog 必須有 `role="dialog"` 與 `aria-modal="true"`，並把 focus trap 在 modal 內。

### Performance（sidepanel 常駐 → 對效能更敏感）
- **避免每次重繪整棵 list**：書籤 / 分頁列表變化時用 diff render，不要 `innerHTML = ''` 重畫。
- **DocumentFragment 批次更新**（AGENTS.md "Memory Tips" 已列）。
- **避免在 list 內塞大尺寸圖片**：favicon 用 16-32px 即可；自訂背景圖請 WebP 壓縮。

### 安全
- **嚴禁 `innerHTML` 處理 user input**：使用 `textContent` 或 `modules/utils/textUtils.js` 的 `escapeHtml`。
- **CSP 相容**：sidepanel 受 extension CSP 限制，不可使用 `eval` / inline scripts / 外部 CDN。

## 輸出格式範例

```
sidepanel.html:42  純圖示按鈕缺少 aria-label
modules/ui/tabRenderer.js:88  使用 innerHTML 渲染來自 chrome.tabs API 的標題，未經 escapeHtml
modules/ui/customThemeManager.js:130  自訂背景色與 foreground 對比度低於 WCAG AA (3.2:1)
```

