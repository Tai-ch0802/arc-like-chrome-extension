# RULE_007_SDD_WORKFLOW

## 1. 核心原則 (Core Principles)
本專案採用 **Spec-Driven Development (SDD)** 流程。
**原則**: 沒有文檔，就沒有程式碼 (No Spec, No Code)。任何功能新增 (Feature) 或修復 (Fix) 在撰寫程式碼之前，**必須**先完成完整的需求文件 (PRD) 與系統分析文件 (SA)。

## 2. 文件規範 (Documentation Standards)

所有規格文件必須存放在 `/docs/specs/` 目錄下，並遵循以下結構：

### 2.1 目錄結構
```
/docs/specs/
  ├── {type}/                  # 類型分類: feature 或 fix
  │    └── {prefix}_{desc}/    # 專案資料夾
  │         ├── PRD_spec.md    # 產品需求文件
  │         └── SA_spec.md     # 系統分析文件
```

### 2.2 命名規則
*   **Type**: `feature` (新功能), `fix` (錯誤修復/優化).
*   **Folder Name**: `{prefix}_{desc}`
    *   `prefix`: 日期編碼 (e.g., `20240121`) 或 Ticket ID (e.g., `TICKET-123`)。
    *   `desc`: 簡短的英文描述，使用 kebab-case (e.g., `bookmark-sync`).
    *   Example: `/docs/specs/feature/20240121_bookmark-sync/`
*   **File Names**:
    *   `PRD_spec.md`: Product Requirement Document.
    *   `SA_spec.md`: System Analysis / System Design Document.

## 3. 工作流程 (Workflow)

1.  **Requirement Phase**:
    *   建立目錄 `/docs/specs/{type}/{folder}/`.
    *   撰寫 `PRD_spec.md`.
    *   **User Review**: 必須獲得 User 核准。

2.  **Analysis Phase**:
    *   撰寫 `SA_spec.md` (基於 PRD).
    *   包含技術架構、API 定義、資料結構變更。
    *   **User Review**: 必須獲得 User 核准。

3.  **Implementation Phase**:
    *   只有在 PRD 和 SA 都定稿後，才能開始寫程式碼。
    *   程式碼變更應嚴格遵循 `SA_spec.md` 的設計。

## 4.例外情況 (Exceptions)
僅有以下情況可跳過完整 SDD 流程，但仍建議補上簡易文件：
*   極小的文字修改 (Typos)。
*   緊急的 Hotfix (需事後補文件)。
*   單純的 Refactoring (需遵循 Refactoring Skill，但仍建議有 SA 文件)。
