---
name: puppeteer-test
description: Guide for writing Puppeteer-based end-to-end tests for Chrome Extensions. Use this skill when creating automated tests for extension popup, side panel, service worker, content scripts, or testing service worker termination. Covers Jest integration, browser launch configuration, and extension-specific testing patterns.
---

# Puppeteer Testing for Chrome Extensions

用 Puppeteer + Jest 為 Chrome 擴充功能撰寫端對端自動化測試。

## Quick Start

### 專案初始化

```bash
# 1. 初始化專案
npm init -y

# 2. 安裝依賴
npm install puppeteer jest @jest/globals

# 3. 新增 test script
# package.json:
# "scripts": { "test": "jest ." }
```

### 基本測試範例

```javascript
// index.test.js
const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, '..'); // 擴充功能根目錄

let browser;

beforeEach(async () => {
  browser = await puppeteer.launch({
    headless: false, // 擴充功能需要 headful 模式
    pipe: true,
    enableExtensions: [EXTENSION_PATH],
  });
});

afterEach(async () => {
  await browser.close();
  browser = undefined;
});

test('extension loads successfully', async () => {
  const workerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker'
  );
  expect(workerTarget).toBeDefined();
});
```

---

## Core Patterns

### 1. 載入擴充功能

```javascript
// 使用 enableExtensions 選項
const browser = await puppeteer.launch({
  headless: false, // 或 'new' (新版 headless 模式)
  pipe: true,
  enableExtensions: [EXTENSION_PATH],
});

// 或動態安裝
const browser = await puppeteer.launch({
  pipe: true,
  enableExtensions: true,
});
await browser.installExtension(pathToExtension);
```

### 2. 取得 Service Worker

```javascript
const workerTarget = await browser.waitForTarget(
  target =>
    target.type() === 'service_worker' &&
    target.url().endsWith('background.js') // 依實際檔名調整
);
const worker = await workerTarget.worker();

// 在 Service Worker 中執行程式碼
const result = await worker.evaluate(() => {
  return chrome.storage.local.get('key');
});
```

### 3. 測試側邊欄 (SidePanel)

```javascript
test('sidepanel renders correctly', async () => {
  // 開啟一個頁面以觸發擴充功能
  const page = await browser.newPage();
  await page.goto('https://example.com');

  // 透過 Service Worker 開啟側邊欄
  await worker.evaluate("chrome.sidePanel.open({ windowId: undefined })");

  // 等待側邊欄頁面出現
  const sidePanelTarget = await browser.waitForTarget(
    target => target.type() === 'page' && target.url().endsWith('sidepanel.html')
  );
  const sidepanel = await sidePanelTarget.asPage();

  // 驗證 DOM
  const title = await sidepanel.$eval('h1', el => el.textContent);
  expect(title).toBe('Expected Title');
});
```

### 4. 測試 Popup

```javascript
test('popup renders correctly', async () => {
  // 透過 Service Worker 開啟 Popup
  await worker.evaluate('chrome.action.openPopup();');

  const popupTarget = await browser.waitForTarget(
    target => target.type() === 'page' && target.url().endsWith('popup.html')
  );
  const popup = await popupTarget.asPage();

  // 互動測試
  await popup.click('#some-button');
  await popup.waitForSelector('#result');
});
```

### 5. 測試 Service Worker 終止

```javascript
/**
 * 強制終止 Service Worker
 */
async function stopServiceWorker(browser, extensionId) {
  const host = `chrome-extension://${extensionId}`;
  const target = await browser.waitForTarget(
    t => t.type() === 'service_worker' && t.url().startsWith(host)
  );
  const worker = await target.worker();
  await worker.close();
}

test('survives service worker termination', async () => {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${EXTENSION_ID}/page.html`);

  // 正常操作
  await page.click('button');
  await page.waitForSelector('#response-0');

  // 終止 Service Worker
  await stopServiceWorker(browser, EXTENSION_ID);

  // 驗證終止後仍可運作
  await page.click('button');
  await page.waitForSelector('#response-1');
});
```

---

## Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testTimeout: 30000, // 擴充功能測試需要較長 timeout
  setupFiles: ['<rootDir>/mock-extension-apis.js'], // 若需要 mock
};
```

### Mock Chrome APIs (單元測試用)

```javascript
// mock-extension-apis.js
global.chrome = {
  tabs: {
    query: async () => { throw new Error('Unimplemented.'); }
  },
  storage: {
    local: {
      get: async () => { throw new Error('Unimplemented.'); },
      set: async () => { throw new Error('Unimplemented.'); }
    }
  }
};
```

```javascript
// 在測試中使用 jest.spyOn
test('getActiveTabId returns active tab ID', async () => {
  jest.spyOn(chrome.tabs, 'query')
    .mockResolvedValue([{ id: 3, active: true, currentWindow: true }]);
  
  expect(await getActiveTabId()).toBe(3);
});
```

---

## 本專案測試設定

針對 arc-sidebar 擴充功能的建議配置：

```
tests/
├── e2e/
│   ├── setup.js          # 共用的 browser 設定
│   ├── sidepanel.test.js # 側邊欄 UI 測試
│   ├── tabs.test.js      # 分頁管理測試
│   └── bookmarks.test.js # 書籤功能測試
└── unit/
    ├── mock-chrome.js    # Chrome API mocks
    └── utils.test.js     # 工具函式單元測試
```

---

## Headless 模式

```javascript
// 新版 headless 模式支援擴充功能
const browser = await puppeteer.launch({
  headless: 'new', // 使用新版 headless (Chrome 112+)
  pipe: true,
  enableExtensions: [EXTENSION_PATH],
});
```

> ⚠️ **注意**：舊版 `headless: true` 不支援載入擴充功能，必須使用 `headless: false` 或 `headless: 'new'`。

---

## 常見問題

### 固定擴充功能 ID

測試時建議使用固定 ID，在 `manifest.json` 中加入 `key` 欄位：

```json
{
  "key": "MIIBIjAN..."
}
```

詳見 [維持一致的擴充功能 ID](https://developer.chrome.com/docs/extensions/mv3/manifest/key#keep-consistent-id)。

### Selenium 注意事項

Selenium 的 ChromeDriver 會將 debugger 附加至所有 Service Worker，導致它們不會自動終止。使用 Puppeteer 可避免此問題。

---

## 參考文件

- [Chrome Developers - End-to-end Testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- [Chrome Developers - Puppeteer Testing](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)
- [Chrome Developers - Service Worker Termination Testing](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)
- [Puppeteer Chrome Extensions Guide](https://pptr.dev/guides/chrome-extensions)
