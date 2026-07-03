# Testing Guide — 測試指南

## 測試結構

```
usecase_tests/
├── unit_tests/          # .mjs 單元測試（jsdom 環境，esbuild transform）
└── puppeteer_tests/     # Puppeteer + Jest E2E（真實 Chrome 載入擴充功能）
    └── setup.js         # 共用 helper：setupBrowser() / teardownBrowser()
```

## 指令

```bash
npm run test:unit   # 單元測試（秒級，開發時優先跑）
npm test            # E2E 全套（jest --maxWorkers=2）
npm run test:ci     # CI 快驗：--bail，只跑 happy_path_* 前綴
npm run test:full   # 清 Jest 快取後全跑
npx jest usecase_tests/puppeteer_tests/<file>.test.js   # 單檔（迭代最快）
```

## E2E 命名規則（重要）

| 前綴 | CI 行為 | 用途 |
|---|---|---|
| `happy_path_*.test.js` | ✅ `npm run test:ci` 必跑 | 核心動線 |
| 無前綴 `*.test.js` | ❌ CI 不跑 | edge case / 效能 benchmark，本地通過即可 |

## 撰寫 E2E 的鐵則

- 一律從 `setup.js` 取 `setupBrowser()`（載入擴充功能、解析 extensionId、開好 sidepanel.html），**不要自行 `puppeteer.launch`**。
- 完整模式與範例：`.agent/skills/puppeteer-test/SKILL.md`。

## CI 穩定性方針（歷史失敗經驗總結）

完整 8 條見 `.agent/workflows/review-pr.md`，最常踩的：

1. **禁止 `setTimeout` 固定等待**——改用 `page.waitForFunction()` 條件式等待。
2. **不需要獨立狀態就共用頁面**（`beforeAll` 建一次），測試間手動清理 UI 狀態。
3. **`page.reload()` 後先等容器元素出現**（事件委派就緒）再互動，並搭配重試。
4. **資源清理放 `afterEach`/`finally`**，測試失敗時才不會殘留。
5. **URL 比對用 `startsWith`/`includes`**，不用 `===`（Chrome 會動尾斜線）。
6. **拖曳等 UI 模擬在 headless 不穩**——能用 Chrome API 直接驗證業務邏輯就用 API。

## CI

`.github/workflows/ci.yml`：push/PR 到 `main` 時在 self-hosted runner 跑 `npm run test:full`（timeout 20 分）。另有每日排程的 Testing Enthusiast agent（`.github/workflows/testing-enthusiast.yml`）自動補測試覆蓋，日誌在 `.jules/tester.md`。
