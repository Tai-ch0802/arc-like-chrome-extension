---
description: 專案架構與關鍵檔案說明
---

# 專案架構

## 模組職責對照表

| 檔案路徑 | 角色 | 職責說明 |
|---------|------|---------|
| `sidepanel.js` | **[總指揮]** | 應用程式進入點與總協調者。負責初始化各模組、串連瀏覽器事件監聽（特別是同步書籤與分頁關聯狀態的生命週期事件）。 |
| `modules/uiManager.js` | **[UI Facade]** | UI 模組的入口點。作為 Facade 模式，重新匯出 `modules/ui/` 下的所有子模組功能，保持對外接口一致。 |
| `modules/apiManager.js` | **[通訊]** | Chrome API 的封裝層。統一管理所有對 `chrome.*` API 的呼叫（包含書籤搜尋），方便維護與測試。 |
| `modules/stateManager.js` | **[狀態]** | UI 狀態管理員。集中管理如『書籤資料夾是否展開』等非同步 UI 狀態，以及『書籤-分頁』的持久化關聯狀態。 |
| `modules/modalManager.js` | **[互動]** | 提供客製化的 `showPrompt` 和 `showConfirm` 函式，用以取代原生對話框，提升使用者體驗。 |
| `modules/dragDropManager.js` | **[功能]** | 拖曳排序模組。封裝 SortableJS 的所有邏輯，處理分頁與書籤的拖曳事件，並在拖曳分頁成為書籤時建立關聯。 |
| `modules/searchManager.js` | **[功能]** | 搜尋過濾模組。負責處理搜尋框的輸入與列表的即時過濾邏輯。 |

## UI 子模組

| 檔案路徑 | 職責說明 |
|---------|---------|
| `modules/ui/elements.js` | DOM 元素集中管理。負責匯出所有主要 UI 容器與控制元件的 DOM 引用。 |
| `modules/ui/themeManager.js` | 主題管理。負責主題切換邏輯、設定面板的渲染與事件綁定。 |
| `modules/ui/searchUI.js` | 搜尋介面。負責搜尋結果計數顯示與無結果提示的 UI 更新。 |
| `modules/ui/tabRenderer.js` | 分頁渲染。負責分頁與分頁群組的 DOM 結構生成與事件綁定。 |
| `modules/ui/bookmarkRenderer.js` | 書籤渲染。負責書籤列表、資料夾結構以及連結分頁面板的渲染邏輯。 |

## 工具模組

| 檔案路徑 | 職責說明 |
|---------|---------|
| `modules/utils/virtualScrollUtils.js` | 虛擬滾動工具。負責將書籤樹扁平化為可視列表，支援搜尋過濾並保留階層結構。 |

## 設定檔

| 檔案路徑 | 職責說明 |
|---------|---------|
| `manifest.json` | 擴充功能的設定檔。定義名稱、版本、權限、圖示和快捷鍵等。 |
