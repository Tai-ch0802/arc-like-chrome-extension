---
name: puppeteer-test
description: 本專案 Puppeteer + Jest E2E 測試指南，涵蓋 side panel、service worker、content script、service worker termination、Chrome Extension 載入配置 (--load-extension)。當使用者提到「Puppeteer 測試、E2E 測試、寫測試、自動化測試、寫 puppeteer、test extension」時觸發。
---

# Puppeteer Testing for Chrome Extensions

用 Puppeteer + Jest 為 Chrome 擴充功能撰寫端對端自動化測試。

## Quick Start

### 測試指令（package.json scripts）

```bash
npm test          # 跑全部 E2E：jest --maxWorkers=2 usecase_tests/puppeteer_tests/
npm run test:ci   # CI 快驗：--bail，只跑 happy_path_* 開頭的 E2E
npm run test:full # 先清快取再跑全部 E2E
npm run test:unit # 跑單元測試：jest --maxWorkers=2 usecase_tests/unit_tests/
```

### 基本測試範例

E2E 測試一律從 `usecase_tests/puppeteer_tests/setup.js` 取用共用 helper，
不要自行 `puppeteer.launch`。`setupBrowser()` 會載入擴充功能、動態解析
extensionId，並開啟 `sidepanel.html`。

```javascript
// usecase_tests/puppeteer_tests/<feature>.test.js
const { setupBrowser, teardownBrowser } = require('./setup');

describe('Side Panel Load Use Case', () => {
  let browser;
  let page;
  let extensionId;

  beforeAll(async () => {
    const setup = await setupBrowser();
    browser = setup.browser;
    page = setup.page;            // 已 goto sidepanel.html
    extensionId = setup.extensionId;
    // setup.sidePanelUrl 也可取用
  });

  afterAll(async () => {
    await teardownBrowser(browser);
  });

  test('extension loads successfully', async () => {
    const url = page.url();
    expect(url).toContain('chrome-extension://');
    expect(url).toContain('sidepanel.html');
  });
});
```

---

## Core Patterns

### 1. 載入擴充功能（本專案 setup.js 的實際寫法）

`setupBrowser()`（`usecase_tests/puppeteer_tests/setup.js`）使用 `--load-extension`
旗標載入根目錄擴充功能，並包了 retry（預設 2 次）以容忍 CI 啟動失敗：

```javascript
const EXTENSION_PATH = path.resolve(__dirname, '../../'); // 專案根目錄

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
  ],
});
```

### 2. 動態解析 extensionId

本專案 `manifest.json` 沒有 `key` 欄位，擴充功能 ID 在執行期才產生，
必須從 service_worker target 的 URL 解析（setup.js 已內建並回傳 `extensionId`）：

```javascript
const extensionTarget = await browser.waitForTarget(
  target => target.type() === 'service_worker'
    || target.url().startsWith('chrome-extension://'),
  { timeout: 60000 }
);
const extensionId = extensionTarget.url().split('/')[2];

// 取得 service worker 並執行程式碼（background.js 為 manifest 的 service_worker 入口）
const worker = await extensionTarget.worker();
const result = await worker.evaluate(() => chrome.storage.local.get('key'));
```

### 3. 測試側邊欄 (SidePanel)

本專案 `setupBrowser()` 已直接 `page.goto(sidePanelUrl)`，所以拿到的 `page`
就是側邊欄頁面，無須再開新分頁觸發。等待容器與項目渲染後驗證 DOM：

```javascript
const { setupBrowser, teardownBrowser, waitForTabCount } = require('./setup');

test('sidepanel renders tab list', async () => {
  const { browser, page } = await setupBrowser();
  try {
    await page.waitForSelector('#tab-list', { timeout: 15000 });
    await page.waitForSelector('.tab-item', { timeout: 15000 });
    const tabItems = await page.$$('.tab-item');
    expect(tabItems.length).toBeGreaterThanOrEqual(1);
  } finally {
    await teardownBrowser(browser);
  }
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
  const { browser, page, extensionId } = await setupBrowser();
  try {
    // page 已在 sidepanel.html；先做正常操作
    await page.waitForSelector('#tab-list', { timeout: 15000 });

    // 終止 Service Worker
    await stopServiceWorker(browser, extensionId);

    // 驗證終止後仍可運作（重新整理會喚醒 background.js）
    await page.reload();
    await page.waitForSelector('#tab-list', { timeout: 15000 });
  } finally {
    await teardownBrowser(browser);
  }
});
```

> 本專案目前的 E2E 套件未包含 service worker 終止測試；上例為通用範式，
> 若要新增請放在 `usecase_tests/puppeteer_tests/` 並沿用 setup.js helper。

---

## Jest Configuration（本專案實際設定）

`jest.config.js`（專案根目錄）：

```javascript
/** @type {import('jest').Config} */
const config = {
  testTimeout: 90000,            // CI 穩定性，給足 90s
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./usecase_tests/puppeteer_tests/jest.setup.js'],
  transform: {
    '^.+\\.m?js$': '<rootDir>/jest.esbuild-transform.cjs', // 用 esbuild 轉 ESM
  },
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/?(*.)+(spec|test).mjs'],
};
module.exports = config;
```

### 全域 setup 與 chrome stub

本專案沒有獨立的 mock 檔；retry 設定與 node 端的 chrome stub 都放在
`usecase_tests/puppeteer_tests/jest.setup.js`：

```javascript
// usecase_tests/puppeteer_tests/jest.setup.js
jest.retryTimes(2, { logErrorsBeforeRetry: true }); // 容忍 CI 偶發 flaky

// 給單元測試（.mjs，node 環境）用的最小 chrome stub；
// Puppeteer 測試在真實瀏覽器頁面跑，用的是真正的 chrome API，此 stub 對它們無效。
if (typeof globalThis.chrome === 'undefined') {
  globalThis.chrome = {
    i18n: { getMessage: () => '' },
    storage: { onChanged: { addListener: () => {} } },
    commands: { getAll: async () => [] },
    runtime: {},
  };
}
```

> 單元測試（`usecase_tests/unit_tests/*.test.mjs`）多為純函式測試，import 真實
> 模組並直接斷言；若模組於載入期觸碰 `chrome.*`，上面的 stub 已足夠。需要更細的
> 行為可在個別測試以 `jest.spyOn` 覆寫。

---

## 本專案測試目錄結構

```
usecase_tests/
├── puppeteer_tests/                 # E2E（*.test.js，CommonJS）
│   ├── setup.js                     # 共用 helper（setupBrowser/teardownBrowser…）
│   ├── jest.setup.js                # retry + node 端 chrome stub
│   ├── happy_path_sidepanel_load.test.js
│   ├── happy_path_search.test.js
│   ├── happy_path_spotlight_search.test.js
│   ├── tab_dragging.test.js
│   ├── bookmark_dragging.test.js
│   └── … (含 happy_path_*、*_edge_cases、perf_* 等)
└── unit_tests/                      # 單元測試（*.test.mjs，ESM）
    ├── searchUtils.test.mjs
    ├── colorUtils.test.mjs
    ├── syncEngine.test.mjs
    └── …
```

`setup.js` 匯出的 helper（撰寫測試請優先複用，避免重造 race condition 處理）：
`setupBrowser`、`teardownBrowser`、`expandBookmarksBar`、`waitForTabCount`、
`waitForAttribute`、`waitForTextContent`、`waitForElementRemoved`、`waitForClass`、
`waitForChevron`、`waitForTheme`。

---

## Headless 模式

本專案 `setup.js` 固定使用新版 headless（`headless: 'new'`）搭配 `--load-extension`：

```javascript
const browser = await puppeteer.launch({
  headless: 'new', // 新版 headless（Chrome 112+）才支援載入擴充功能
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
  ],
});
```

> ⚠️ **注意**：舊版 `headless: true` 不支援載入擴充功能，必須使用 `headless: 'new'`（或 `headless: false`）。

---

## 常見問題

### 擴充功能 ID 是執行期動態產生

本專案 `manifest.json` **沒有** `key` 欄位，因此每次以 `--load-extension` 載入時
ID 都可能不同。**不要在測試中寫死 extensionId**，一律從 `setupBrowser()` 回傳的
`extensionId` 取用（其內部由 service_worker target 的 URL 解析而得）。

若未來真的需要跨次一致的 ID，才考慮在 `manifest.json` 加入 `key` 欄位，
詳見 [維持一致的擴充功能 ID](https://developer.chrome.com/docs/extensions/mv3/manifest/key#keep-consistent-id)。

### Selenium 注意事項

Selenium 的 ChromeDriver 會將 debugger 附加至所有 Service Worker，導致它們不會自動終止。使用 Puppeteer 可避免此問題。

---

## 參考文件

- [Chrome Developers - End-to-end Testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- [Chrome Developers - Puppeteer Testing](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)
- [Chrome Developers - Service Worker Termination Testing](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)
- [Puppeteer Chrome Extensions Guide](https://pptr.dev/guides/chrome-extensions)
