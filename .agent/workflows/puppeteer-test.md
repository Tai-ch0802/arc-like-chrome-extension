---
description: "How to write and run Puppeteer-based E2E tests for Chrome Extensions."
---

# Puppeteer Test Workflow

此 Workflow 用於指導撰寫與執行 Chrome 擴充功能的 Puppeteer 端對端測試。

## Prerequisites

確認已讀取 `.agent/skills/puppeteer-test/SKILL.md` 以了解完整的測試模式與範例。

## 1. Environment Setup

```bash
# 安裝依賴
npm install puppeteer jest @jest/globals --save-dev
```

// turbo
```bash
# 驗證安裝
npx puppeteer --version
```

## 2. Create Test Structure

```bash
# 建立測試目錄
mkdir -p tests/e2e tests/unit
```

建立共用設定檔：

```javascript
// tests/e2e/setup.js
const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, '../..');

async function launchBrowserWithExtension() {
  return await puppeteer.launch({
    headless: false,
    pipe: true,
    enableExtensions: [EXTENSION_PATH],
  });
}

async function getServiceWorker(browser) {
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker'
  );
  return await workerTarget.worker();
}

module.exports = { launchBrowserWithExtension, getServiceWorker, EXTENSION_PATH };
```

## 3. Write Test Cases

1. **識別測試場景**：
   - 側邊欄 UI 渲染
   - 分頁操作 (開啟、關閉、切換)
   - 書籤功能 (新增、刪除、拖曳)
   - Service Worker 終止後恢復

2. **撰寫測試檔案**：

```javascript
// tests/e2e/sidepanel.test.js
const { launchBrowserWithExtension, getServiceWorker } = require('./setup');

let browser, worker;

beforeEach(async () => {
  browser = await launchBrowserWithExtension();
  worker = await getServiceWorker(browser);
});

afterEach(async () => {
  await browser.close();
});

test('sidepanel loads correctly', async () => {
  const page = await browser.newPage();
  await page.goto('https://example.com');
  
  // 驗證擴充功能正常運作
  expect(worker).toBeDefined();
});
```

## 4. Configure Jest

```javascript
// jest.config.js
module.exports = {
  testTimeout: 30000,
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
};
```

更新 `package.json`：

```json
{
  "scripts": {
    "test": "jest",
    "test:e2e": "jest tests/e2e",
    "test:unit": "jest tests/unit"
  }
}
```

## 5. Run Tests

// turbo
```bash
# 執行所有測試
npm test
```

// turbo
```bash
# 僅執行 E2E 測試
npm run test:e2e
```

// turbo
```bash
# 執行特定測試檔案
npx jest tests/e2e/sidepanel.test.js
```

## 6. CI Integration (Optional)

在 `.github/workflows/test.yml` 中加入：

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:e2e
        env:
          PUPPETEER_HEADLESS: 'new'
```

## Debugging Tips

1. **觀察瀏覽器行為**：設定 `headless: false` 查看實際執行
2. **截圖除錯**：
   ```javascript
   await page.screenshot({ path: 'debug.png' });
   ```
3. **增加 timeout**：複雜操作可能需要較長等待時間
4. **檢視 Console 錯誤**：
   ```javascript
   page.on('console', msg => console.log('PAGE LOG:', msg.text()));
   ```
