---
name: sa
description: 撰寫本專案 (vanilla JS Chrome extension) 的 SA (系統分析) 文件，重點為模組架構、chrome.storage schema、message passing、Test Impact Analysis。本專案無 backend / 無 DB，SA 聚焦前端 module 切分與狀態流。當使用者提到「SA、系統分析、技術方案、架構設計、模組規劃、Test Impact」時觸發。SDD 流程的 Phase 2。
---

# System Analysis (SA) Skill

本技能專注於系統分析與設計 (System Analysis & Design)，旨在將 PRD 中的業務需求轉化為可執行的技術方案。SA 是連接 "What to do" (PRD) 與 "How to do" (Code) 的橋樑。

## SA 的核心職責

1.  **架構設計 (Architecture Design)**: 定義系統的高層結構、模組劃分與職責。
2.  **資料建模 (Data Modeling)**: 設計資料庫 Schema、資料結構與存儲方案。
3.  **介面設計 (Interface Design)**: 定義 API 規格、函數簽名 (Function Signatures) 與互動協議。
4.  **流程邏輯 (Process Logic)**: 透過圖表 (Flowchart, Sequence Diagram) 釐清複雜的業務邏輯。
5.  **測試策略 (Testing Strategy)**: **[Critical]** 分析變更對現有測試的影響，並定義測試計畫。

## SA 產出物 (Artifacts)

*   **System Design Document (SDD)**: 系統設計說明書 (注意：此縮寫與 Spec-Driven Development 相同，需視上下文而定)。本技能中我們使用 `references/system_design_doc.md`。
*   **API Specification**: API 規格書 (Swagger/OpenAPI or Markdown)。
*   **Database Schema**: ER Model 或 JSON Schema 定義。

## 如何使用此 Skill

當 User 需要進行技術評估或設計時 (e.g., "幫我規劃一下這個功能的資料結構"):

1.  **Analyze**: 審閱 PRD，確認所有功能需求的技術可行性。
2.  **Model**:
    *   **Data**: 設計 JSON 物件或 DB Table。
    *   **Process**: 繪製 Mermaid Sequence Diagram。
3.  **Validate Tests**: 
    *   搜尋與變更模組相關的所有測試檔案 (grep/find)。
    *   分析測試代碼是否依賴將被更改的內部實作 (Internal Imports) 或 DOM 結構。
    *   在 SA 文件中明確列出 *必須修改的測試檔案* 與 *必須保留的 DOM 結構*。
4.  **Design**: 填寫 `system_design_doc.md` 模板。
5.  **Review**: 請 User 確認技術方案是否符合專案架構規範。

## 常用工具

*   **Mermaid**: 用於繪製流程圖、循序圖、類別圖與狀態圖。請參考 `references/diagram_guide.md`。
*   **TypeScript / JSDoc**: 用於精確定義資料型別與介面。

## 檢查清單 (Checklist)

*   [ ] 是否考慮了邊界情況 (Edge Cases)？
*   [ ] 資料結構是否具備擴充性？
*   [ ] 是否符合現有的程式碼風格與架構模式？
*   [ ] 是否評估了性能影響 (Performance Impact)？
*   [ ] **[Must]** 是否已識別所有受影響的測試案例，並規劃了與程式碼變更同步的測試修正？

## 本專案 SA 重點（vanilla JS Chrome extension，無 backend）

本專案沒有伺服器、沒有資料庫、沒有 REST API。SA 文件的「資料建模 / 介面設計」需轉譯為前端等價物：

| 通用 SA 概念 | 本專案對應 |
|---|---|
| Database Schema | `chrome.storage.local` / `chrome.storage.sync` 的 key-value schema |
| REST API | `chrome.runtime.sendMessage` / `onMessage` 的訊息協定 (Message Passing) |
| Function Signatures | `modules/` 下各 module 的 export interface（JSDoc 標型） |
| 後端服務切分 | `modules/{apiManager, stateManager, dragDropManager, ...}` 的職責劃分 |

### 必填章節（本專案 SA_spec.md）

1. **Module Impact Map**：列出受影響的 `modules/` 子模組（apiManager / stateManager / ui/* / utils/* / aiManager / rssManager / readingListManager）。
2. **Message Flow**：若涉及 background ↔ sidepanel ↔ content script 通訊，畫 Mermaid sequence diagram。
3. **Storage Schema Diff**：若改動 `chrome.storage` 結構，列出「before / after」JSON shape 與 migration 策略。
4. **Manifest Diff**：若新增 permissions / host_permissions / commands，明確列出 manifest.json 變更。
5. **Test Impact Analysis** ⭐：
   - `tests/`（Jest 單元測試）：列出哪些檔案的測試需要修改。
   - `usecase_tests/`（Puppeteer E2E）：列出 DOM 選擇器（`.tab-item[data-tab-id]` 等）若變動會影響哪些 E2E。
   - `scripts/__tests__/`（build/script 測試）：列出 Makefile 或建置流程的測試影響。

### 工具

*   **Mermaid**：流程圖、sequence diagram、state diagram。詳見 `references/diagram_guide.md`。
*   **JSDoc**：本專案無 TypeScript，型別契約靠 JSDoc 標註（`@typedef`、`@param`、`@returns`）。
