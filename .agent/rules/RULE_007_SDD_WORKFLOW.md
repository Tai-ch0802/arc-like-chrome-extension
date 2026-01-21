---
trigger: always_on
---

# RULE_007_SDD_WORKFLOW
## 1. 核心原則 (Core Principles)
本專案採用 **Spec-Driven Development (SDD)** 流程。
1.  **No Spec, No Code**: 任何功能新增 (Feature) 或修復 (Fix) 在撰寫程式碼之前，**必須**先完成完整的需求文件 (PRD) 與系統分析文件 (SA)。
2.  **Living Documentation**: 程式碼與規格文件必須保持同步。若實作中發現設計需變更，必須**先更新規格**，再修改程式碼。
## 2. 文件規範 (Documentation Standards)
所有規格文件必須存放在 `/docs/specs/` 目錄下，並遵循以下結構：
### 2.1 目錄結構 & 命名規則
```
/docs/specs/
  ├── {type}/                  # 分類: feature 或 fix
  │    └── {ID_PREFIX}_{desc}/ # 專案資料夾
  │         ├── PRD_spec.md    # 產品需求文件
  │         └── SA_spec.md     # 系統分析文件
```
**ID_PREFIX 類型**:
*   **ISSUE (標準)**: 對應 GitHub Issue ID (e.g., `ISSUE-123_tab-groups`).
*   **PR (外部)**: 對應外部 Pull Request ID (e.g., `PR-456_typo-fix`).
*   **BASE (基底)**: 初始或基礎架構規格 (e.g., `BASE-001_initial-setup`).
**描述 (desc)**: 簡短英文，使用 kebab-case (e.g., `bookmark-sync`).
### 2.2 檔案內容
*   `PRD_spec.md`: 必須包含 User Stories 與 **Acceptance Criteria**。
*   `SA_spec.md`: 必須包含 System Architecture, APIs, 與 **Traceability Matrix**。
## 3. 工作流程 (Workflow)
1.  **Requirement Phase**:
    *   確認 Issue ID 並建立目錄。
    *   撰寫 `PRD_spec.md` -> **User Review (Approved)**.
2.  **Analysis Phase**:
    *   撰寫 `SA_spec.md` -> **User Review (Approved)**.
3.  **Implementation Phase**:
    *   **Pre-Check**: 確認 Spec 狀態為 Approved。
    *   **Coding**: 依據 Spec 實作。
    *   **Sync**: ⚠️ 若實作遇阻需變更設計，**暫停 Coding -> 更新 Spec -> 取得核准 -> 繼續 Coding**。
4.  **Verification Phase**:
    *   **Test**: 執行單元測試與手動驗收。
    *   **Report**: 對照 PRD 的 Acceptance Criteria 產出驗收結果。
## 4.例外情況 (Exceptions)
僅有以下情況可跳過完整 SDD 流程，但仍建議補上簡易文件：
*   極小的文字修改 (Typos)。
*   緊急的 Hotfix (需事後補文件，使用 `BASE` 或 `ISSUE` ID)。
*   單純的 Refactoring (需遵循 Refactoring Skill，建議仍有簡易 SA)。