---
name: sdd
description: "Spec-Driven Development (SDD): A structured workflow (Requirement -> Analysis -> Implementation) enforcing explicit documentation before coding."
---

# Spec-Driven Development (SDD) Skill

本技能整合了 **PRD (需求)** 與 **SA (分析)** 的知識，定義了本專案的標準開發流程。核心原則是 **"No Spec, No Code"**。

## 核心流程 (Core Workflow)

本專案採用三階段開發模式，所有產出物皆存放於按照 `RULE_007` 定義的 `/docs/specs/` 目錄中。

### Phase 1: Product Requirement (PRD)
*   **目標**: 定義 "做什麼" (What) 和 "為什麼做" (Why)。
*   **檔案位置**: `/docs/specs/{type}/{prefix}_{desc}/PRD_spec.md`
*   **參考技能**: `prd` (詳見 `.agent/skills/prd/SKILL.md`)
*   **關鍵內容**:
    *   User Stories
    *   Functional Requirements (EARS syntax)
    *   Success Metrics
    *   Out of Scope

### Phase 2: System Analysis (SA)
*   **目標**: 定義 "如何做" (How)。將業務需求轉化為技術規格。
*   **檔案位置**: `/docs/specs/{type}/{prefix}_{desc}/SA_spec.md`
*   **參考技能**: `sa` (詳見 `.agent/skills/sa/SKILL.md`)
*   **關鍵內容**:
    *   System Architecture (Mermaid)
    *   API Specifications
    *   Data Models / Schema Changes
    *   Implementation Steps (Tasks)

### Phase 3: Implementation
*   **目標**: 執行 SA 階段定義的任務。
*   **行動**:
    *   依據 `SA_spec.md` 進行 Coding。
    *   對照 `PRD_spec.md` 進行驗收測試。

## 目錄結構範例

```text
/docs/specs/
  ├── feature/
  │    └── 20240121_tab-groups/
  │         ├── PRD_spec.md   <-- Must be approved first
  │         └── SA_spec.md    <-- Must be approved second
  └── fix/
       └── 20240122_sync-bug/
            ├── PRD_spec.md
            └── SA_spec.md
```

## Agent 操作指引

當接到 User 任務時：

1.  **Check Rule**: 確認是否符合 `RULE_007`。
2.  **Scaffold**: 使用 `mkdir -p` 建立正確的資料夾路徑。
3.  **Draft PRD**: 撰寫 `PRD_spec.md` 並請求 Review。
4.  **Draft SA**: 核准後，撰寫 `SA_spec.md` 並請求 Review。
5.  **Code**: 核准後，開始實作。

## 相關模板 (References)

*   **PRD 模板**: `.agent/skills/prd/references/template_comprehensive.md`
*   **SA 模板**: `.agent/skills/sa/references/system_design_doc.md`
