---
name: sdd
description: "Spec-Driven Development (SDD): A structured workflow (Requirement -> Analysis -> Implementation) enforcing explicit documentation before coding."
---

# Spec-Driven Development (SDD) Skill

本技能整合了 **PRD (需求)** 與 **SA (分析)** 的知識，定義了本專案的標準開發流程。核心原則是 **"No Spec, No Code"**。

## 核心原則

1.  **Spec-First**: 先有規格，才有程式碼
2.  **Traceability**: 每個需求都可追溯到設計與實作
3.  **Acceptance-Driven**: 每個需求都有可驗證的驗收條件
4.  **Version Control**: 規格文件有版本控制，變更需走流程

## 核心流程 (Core Workflow)

本專案採用三階段開發模式，所有產出物皆存放於按照 `RULE_007` 定義的 `/docs/specs/` 目錄中。

### Phase 1: Product Requirement (PRD)
*   **目標**: 定義 "做什麼" (What) 和 "為什麼做" (Why)。
*   **檔案位置**: `/docs/specs/{type}/{prefix}_{desc}/PRD_spec.md`
*   **參考技能**: `prd` (詳見 `.agent/skills/prd/SKILL.md`)
*   **快速指南**: `sdd/references/requirements.md`
*   **關鍵內容**:
    *   User Stories (US-XX)
    *   Functional Requirements (FR-XX, EARS syntax)
    *   **Acceptance Criteria** (Given-When-Then) ⭐ 必要
    *   Success Metrics / Out of Scope
*   **版本控制**: 使用 Version 欄位 (e.g., v1.0)

### Phase 2: System Analysis (SA)
*   **目標**: 定義 "如何做" (How)。將業務需求轉化為技術規格。
*   **檔案位置**: `/docs/specs/{type}/{prefix}_{desc}/SA_spec.md`
*   **參考技能**: `sa` (詳見 `.agent/skills/sa/SKILL.md`)
*   **快速指南**: `sdd/references/design.md`
*   **關鍵內容**:
    *   **Requirement Traceability Matrix** ⭐ 必要
    *   System Architecture (Mermaid)
    *   API Specifications / Data Models
    *   **Test Impact Analysis** ⭐ 必要
*   **版本控制**: 標註對應的 PRD 版本

### Phase 3: Implementation
*   **目標**: 執行 SA 階段定義的任務。
*   **參考指南**: `sdd/references/tasks.md`
*   **前置條件**: PRD 和 SA 都必須進入 **Approved/Frozen** 狀態
*   **行動**:
    *   依據 `SA_spec.md` 進行 Coding
    *   對照 `PRD_spec.md` 的 Acceptance Criteria 進行驗收

## 目錄結構範例

```text
/docs/specs/
  ├── feature/
  │    └── 001_tab-groups/
  │         ├── PRD_spec.md   <-- v1.0, Frozen
  │         └── SA_spec.md    <-- v1.0, Frozen
  └── fix/
       └── 002_sync-bug/
            ├── PRD_spec.md   <-- v1.1, Approved
            └── SA_spec.md    <-- v1.0, Approved
```

## Agent 操作指引

當接到 User 任務時：

1.  **Check Rule**: 確認是否符合 `RULE_007`。
2.  **Scaffold**: 使用 `mkdir -p` 建立正確的資料夾路徑。
3.  **Draft PRD**: 撰寫 `PRD_spec.md`，**必須包含 Acceptance Criteria**。
4.  **Review Gate**: 請求 User Review，等待核准。
5.  **Draft SA**: 撰寫 `SA_spec.md`，**必須包含 Requirement Traceability**。
6.  **Review Gate**: 請求 User Review，等待核准。
7.  **Code**: 核准後，開始實作。
8.  **Verify**: 對照 Acceptance Criteria 驗收。

## Spec 變更流程

當 Spec 進入 **Frozen** 狀態後，任何變更需：

1.  建立新版本 (e.g., v1.0 → v1.1)
2.  在 Revision History 中記錄變更原因
3.  重新取得 Reviewer 核准
4.  更新相關的 Traceability Matrix

## 相關資源 (References)

| Phase | Quick Guide | Full Template |
|-------|-------------|---------------|
| **PRD** | `sdd/references/requirements.md` | `prd/references/template_comprehensive.md` |
| **SA** | `sdd/references/design.md` | `sa/references/system_design_doc.md` |
| **Tasks** | `sdd/references/tasks.md` | - |
