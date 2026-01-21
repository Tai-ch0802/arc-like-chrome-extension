---
name: prd
description: "Guidelines and templates for creating effective Product Requirement Documents (PRD), bridging the gap between business goals and technical implementation."
---

# Product Requirement Document (PRD) Skill

本技能旨在協助撰寫結構完整、邏輯清晰的產品需求文件 (PRD)。PRD 是產品的核心藍圖，它告訴我們「為什麼要建構這個產品」以及「它應該具備什麼功能」。

## 為何需要 PRD？

*   **對齊目標**: 確保開發者、設計師和利害關係人對產品有共同的理解。
*   **減少歧義**: 透過清晰的文字與圖表，將模糊的想法轉化為具體的需求。
*   **作為測試基準**: PRD 中的驗收標準 (Acceptance Criteria) 是 QA 測試的依據。

## PRD 核心組成

一份完整的 PRD 通常包含以下章節：

1.  **背景與目標 (Background & Goals)**: 為什麼要做？解決什麼問題？成功指標是什麼？
2.  **使用者故事 (User Stories)**: 誰是使用者？他們想要做什麼？為了達到什麼目的？
3.  **功能需求 (Functional Requirements)**: 具體的系統行為描述。
4.  **非功能需求 (Non-Functional Requirements)**: 性能、安全性、可靠性等限制。
5.  **UI/UX 流程 (User Interaction)**: 頁面流程圖、Wireframe 或 Mockup 連結。
6.  **數據埋點 (Analytics)**: 需要追蹤哪些使用者行為數據。
7.  **未包含範圍 (Out of Scope)**: 明確定義什麼 **不做**，以避免範圍蔓延 (Scope Creep)。

## 如何使用此 Skill

當 User 提出一個模糊的想法 (e.g., "我想做一個讓使用者可以分享書籤的功能")，請依循以下步驟：

1.  **Initial Interview**: 詢問 User 關鍵問題 (Who, Why, What)。
2.  **Drafting**: 使用 `template_comprehensive.md` (完整版) 或 `template_simple.md` (簡易版) 起草 PRD。
3.  **Review**: 請 User 審閱草稿，確認是否符合預期。
4.  **Finalize**: 定稿後，這份 PRD 將成為後續 SA (系統分析) 和 SDD (開發規格) 的輸入。

## 技巧與最佳實踐

*   **使用清晰的語言**: 避免 "可能"、"應該" 等模糊詞彙，使用 "必須" (Shall/Must)、"可以" (Can) 等明確用語。
*   **圖文並茂**: 盡量使用流程圖 (Mermaid) 來輔助文字說明。
*   **保持更新**: PRD 是活的文件 (Living Document)，若需求變更，務必更新 PRD。
