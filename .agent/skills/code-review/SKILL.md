---
name: code-review
description: Reviews code changes for bugs, style issues, and best practices. Use when reviewing PRs or checking code quality.
---

# Code Review Skill

當進行程式碼審查時，請遵循以下步驟：

## 審查清單 (Review checklist)

1. **正確性 (Correctness)**：程式碼是否符合預期功能？
2. **邊界情況 (Edge cases)**：是否處理了錯誤條件？以及思考是否存在其他未被考慮到的情況。
3. **風格 (Style)**：是否符合專案規範？
4. **效能 (Performance)**：是否存在明顯的效率低落？

## Chrome Extension 專屬檢查

由於這是一個 Chrome 擴充功能專案，額外檢查以下項目：

1. **Manifest V3 相容性**：確認使用的 API 符合 Manifest V3 規範
2. **Chrome API 使用**：確認正確使用 `chrome.tabs`、`chrome.bookmarks` 等 API
3. **權限最小化**：確認只請求必要的權限

## Puppeteer 測試穩定性檢查

審查 Puppeteer 測試時，特別注意潛在的 race condition：

| 反模式 ❌ | 正確模式 ✅ | 說明 |
|-----------|-------------|------|
| `await new Promise(r => setTimeout(r, 2000))` | `await page.waitForFunction(...)` | 固定延遲會在 CI 環境不穩定 |
| `setTimeout(r, 500)` debounce | `waitForSelector` + visibility | 等待實際 DOM 狀態 |
| 等待 active tab URL 精確匹配 | 檢查 tab count 或使用 `includes` | Headless 環境 navigation 可能被阻擋 |
| 直接 click 後立即驗證 | `waitForFunction` 後再驗證 | 給予 Chrome API 回應時間 |

### 正確等待模式範例

```javascript
// ✅ 等待 tab 出現在 DOM
await page.waitForFunction(
    (id) => document.querySelector(`.tab-item[data-tab-id="${id}"]`),
    { timeout: 10000 },
    createdTabId
);

// ✅ 等待 modal 關閉
await page.waitForFunction(
    () => !document.querySelector('.modal-content'),
    { timeout: 5000 }
);

// ✅ 等待 tab count 增加
await page.waitForFunction(
    (expected) => {
        return new Promise(resolve => {
            chrome.tabs.query({}, tabs => resolve(tabs.length >= expected));
        });
    },
    { timeout: 10000 },
    initialTabCount + 1
);
```

## 如何提供回饋

- 不需要給予太多浮誇的稱讚來滿足 PR 提交者的行緒價值
- 具體指出需要修改的地方
- 解釋「為什麼」，而不僅僅是「什麼」
- 儘可能提供替代方案

## 自動化工具

在開始人工審查之前，**先執行 lint 檢查腳本**以快速發現常見問題：

```bash
.agent/skills/code-review/scripts/lint-check.sh .
```

### 何時使用

- **PR 審查開始時**：在閱讀程式碼之前先跑一次，快速掌握潛在問題
- **提交前自檢**：開發者可在提交 PR 前自行檢查
- **CI 整合**：可加入 CI pipeline 作為自動化檢查

### 腳本檢查項目

| 檢查項目 | 嚴重程度 | 說明 |
|----------|----------|------|
| `console.log` | ⚠️ 警告 | 殘留的除錯語句 |
| `innerHTML` | ⚠️ 警告 | 潛在 XSS 風險 |
| `eval()` | ❌ 錯誤 | 嚴重安全風險 |
| `TODO/FIXME` | 📝 資訊 | 未完成項目 |
| 未處理的 Promise | ⚠️ 警告 | 可能的錯誤遺漏 |
| `setTimeout` 固定等待 | ⚠️ 警告 | 測試中使用可能造成 CI race condition |

## 參考資料

詳細的審查標準請參考：

- [安全檢查清單](references/security-checklist.md) - 權限、CSP、API 安全
- [效能模式](references/performance-patterns.md) - DOM 操作、事件處理最佳實踐
- [程式碼風格指南](references/style-guide.md) - 命名慣例、模組結構
