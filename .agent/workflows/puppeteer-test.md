---
description: "How to write and run Puppeteer-based E2E tests for this Chrome extension (usecase_tests/)."
---

# Puppeteer Test Workflow

此 Workflow 是撰寫與執行本專案 E2E 測試的**執行入口**。
測試模式、範例與反模式以 `.agent/skills/puppeteer-test/SKILL.md` 為單一事實來源；
CI 穩定性方針（禁止 setTimeout 固定等待等 8 條）見 `.agent/workflows/review-pr.md`。

> ⚠️ 測試基礎建設**已存在**：不要新建 `tests/` 目錄、不要改寫 `jest.config.js` 或
> `package.json` scripts。所有 E2E 測試放 `usecase_tests/puppeteer_tests/`、
> 單元測試放 `usecase_tests/unit_tests/`（.mjs）。

## 1. 認識既有結構

// turbo
```bash
ls usecase_tests/puppeteer_tests/ | head -20
```

- 共用 helper：`usecase_tests/puppeteer_tests/setup.js` 的 `setupBrowser()` / `teardownBrowser()`
  —— 會載入擴充功能、解析 extensionId、開好 `sidepanel.html`。**禁止自行 `puppeteer.launch`**。
- 檔名規則：`happy_path_*.test.js` = CI 必跑的核心動線；無前綴 = edge case（CI 不跑）。

## 2. 撰寫測試

1. 讀 `.agent/skills/puppeteer-test/SKILL.md` 取用範例骨架。
2. 從 `setup.js` import helper，沿用既有測試檔的結構（`beforeAll` 共用頁面）。
3. 等待一律用 `waitForSelector` / `waitForFunction` 條件式等待，清理放 `afterEach`。

## 3. 執行

// turbo
```bash
# 單一測試檔（開發時優先，最快回饋）
npx jest usecase_tests/puppeteer_tests/<test-file>.test.js
```

// turbo
```bash
# CI 等價快驗（僅 happy_path_*，--bail）
npm run test:ci
```

```bash
npm test           # 全部 E2E
npm run test:unit  # 單元測試
npm run test:full  # 清快取後全跑（懷疑快取汙染時）
```

## 4. Debug

- 觀察瀏覽器：把 `setupBrowser()` 的 headless 暫時改 `false`（提交前改回）。
- 截圖：`await page.screenshot({ path: 'debug.png' })`（記得刪除產物）。
- 頁面 console：`page.on('console', msg => console.log('PAGE:', msg.text()))`。
- Flaky 分辨：連跑 3 次；只在 CI 掛 → 對照 review-pr.md 的 CI 穩定性方針逐條檢查。
