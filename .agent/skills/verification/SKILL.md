---
name: verification
description: 交付前驗證紀律：依變更類型選擇最小充分驗證組合（unit / 目標 E2E / happy-path CI / make build）、Makefile 打包檢查、i18n 連動、GEMINI.md key_files 同步、誠實回報。當使用者提到「驗證、收尾、完成了嗎、可以交付嗎、送 PR 前、檢查一下」或任何實作即將收尾時觸發。
---

# Verification Skill — 完成的定義

「寫完 code」不等於「完成」。本 skill 定義**宣稱完成前必須通過的驗證**，以及對應變更類型的最小充分火力表——不多跑浪費時間，不少跑帶病交付。

## 核心原則

1. **驗證強度對應變更風險**，不是一律全跑（`npm run test:full` 全套很貴），也不是一律不跑。
2. **宣稱什麼，就要驗過什麼**。說「修好了」之前要親眼看到修好的證據；說「不影響其他功能」之前要跑過對應測試。
3. **誠實回報**：測試失敗就回報失敗與輸出，跳過的步驟就明說跳過。絕不把「應該會過」寫成「已通過」。

## 驗證火力表（依變更類型取聯集）

| 變更類型 | 必跑 | 說明 |
|---|---|---|
| 純文件（docs/、*.md、spec） | 無自動化 | 人工檢查連結與檔案引用是否存在 |
| `modules/utils/`、純函式、`modules/sync/syncLogic` | `npm run test:unit` | 單元測試最快，先跑 |
| UI / renderer / 互動邏輯 | 相關單一 E2E 檔 → `npm run test:ci` | 先跑最相關的一檔（快），過了再跑 happy-path 全套 |
| `manifest.json` / `Makefile` / 新增檔案 | `make` + `make release`，並檢查 zip 內容 | 漏打包是本專案歷史事故，見下方檢查法 |
| `background.js` / service worker 邏輯 | 相關 E2E + 手動情境思考「SW 終止後還對嗎」 | in-memory 狀態存活性 |
| 測試本身的修改 | 該測試檔連跑 3 次 | 排除 flaky 假陽性 |

```bash
# 常用指令
npm run test:unit                                          # 單元測試（秒級）
npx jest usecase_tests/puppeteer_tests/<related>.test.js   # 目標 E2E
npm run test:ci                                            # happy-path 全套（CI 等價）
make && make release                                       # 兩種 build 都要能過
```

## 連動檢查清單（改 code 之外的義務）

- [ ] **Makefile**：新增/改名的檔案是否已在 `DEV_SRC_FILES`？prod 需要的話是否在 `PROD_STATIC_FILES` 或 esbuild 指令中？驗證法：`unzip -l arc-sidebar-v*-dev.zip | grep <新檔名>`。
- [ ] **i18n**：新增使用者可見文案 → `_locales/`（14 語）要補 key；README / store description 層級的文案 → 觸發 `update-multilingual-docs` skill。
- [ ] **GEMINI.md `key_files`**：新增模組或改變既有模組職責時同步更新描述（專案歷史約定）。
- [ ] **spec 對照**（T1/T2 案件）：逐條核對 SPEC.md 驗收條件 / PRD Acceptance Criteria，在 PR description 回報結果。
- [ ] **暫時性產物清除**：debug 用 console.log、截圖檔、暫存 md 檔都已移除。

## 回報格式（PR description 或對話收尾）

```
驗證結果：
- npm run test:unit：✅ 42 passed
- npx jest .../happy_path_search.test.js：✅ 4 passed
- make && make release：✅ 產物包含新檔案 modules/foo.js
- 未跑：npm run test:full（變更不涉及其他動線；CI 會跑）
```

有失敗就照實列出失敗輸出與你的判斷（是本次變更造成、還是既有 flaky——flaky 判斷依據見 `debugging` skill）。
