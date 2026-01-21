---
name: sa
description: "Methodologies for System Analysis (SA), focusing on technical architecture, data flow modeling, and API design."
---

# System Analysis (SA) Skill

本技能專注於系統分析與設計 (System Analysis & Design)，旨在將 PRD 中的業務需求轉化為可執行的技術方案。SA 是連接 "What to do" (PRD) 與 "How to do" (Code) 的橋樑。

## SA 的核心職責

1.  **架構設計 (Architecture Design)**: 定義系統的高層結構、模組劃分與職責。
2.  **資料建模 (Data Modeling)**: 設計資料庫 Schema、資料結構與存儲方案。
3.  **介面設計 (Interface Design)**: 定義 API 規格、函數簽名 (Function Signatures) 與互動協議。
4.  **流程邏輯 (Process Logic)**: 透過圖表 (Flowchart, Sequence Diagram) 釐清複雜的業務邏輯。

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
3.  **Design**: 填寫 `system_design_doc.md` 模板。
4.  **Review**: 請 User 確認技術方案是否符合專案架構規範。

## 常用工具

*   **Mermaid**: 用於繪製流程圖、循序圖、類別圖與狀態圖。請參考 `references/diagram_guide.md`。
*   **TypeScript / JSDoc**: 用於精確定義資料型別與介面。

## 檢查清單 (Checklist)

*   [ ] 是否考慮了邊界情況 (Edge Cases)？
*   [ ] 資料結構是否具備擴充性？
*   [ ] 是否符合現有的程式碼風格與架構模式？
*   [ ] 是否評估了性能影響 (Performance Impact)？
