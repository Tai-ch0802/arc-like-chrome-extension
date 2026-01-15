# 程式碼風格指南

此專案的 JavaScript 程式碼風格規範。

## 命名慣例

| 類型 | 慣例 | 範例 |
|------|------|------|
| 變數/函式 | camelCase | `tabElement`, `handleClick` |
| 常數 | UPPER_SNAKE_CASE | `MAX_TABS`, `DEFAULT_THEME` |
| 類別 | PascalCase | `TabManager`, `BookmarkRenderer` |
| 私有成員 | 前綴底線 | `_privateMethod` |
| CSS 類別 | kebab-case | `tab-item`, `bookmark-folder` |

## 模組結構

```javascript
// 1. 匯入 (按照：內建 → 第三方 → 專案內部)
import { someFunction } from './utils.js';

// 2. 常數定義
const DEFAULT_VALUE = 10;

// 3. 主要邏輯

// 4. 匯出
export { publicFunction };
```

## 註解規範

```javascript
/**
 * 函式說明
 * @param {string} id - 分頁 ID
 * @returns {Promise<Tab>} 分頁物件
 */
function getTab(id) { ... }
```

## 錯誤處理

```javascript
// ✅ 正確：總是處理 Promise rejection
try {
  const result = await chrome.tabs.get(tabId);
} catch (error) {
  console.error('Failed to get tab:', error);
}

// ✅ 正確：檢查 runtime.lastError (callback 風格)
chrome.tabs.get(tabId, (tab) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError.message);
    return;
  }
  // 處理 tab
});
```

## 檔案組織

- 每個模組專注於單一職責
- 相關功能放在同一目錄
- 使用 `index.js` 或 facade 模式匯出公開 API
