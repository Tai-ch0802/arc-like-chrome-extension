# SDD Phase 1: Requirements (PRD)

> 此文件為 SDD 流程的 Phase 1 快速參考指南，詳細內容請參考 **PRD Skill**。

## 📚 完整資源

- **Skill 文件**: [`.agent/skills/prd/SKILL.md`](../../prd/SKILL.md)
- **完整模板**: [`.agent/skills/prd/references/template_comprehensive.md`](../../prd/references/template_comprehensive.md)

---

## 快速檢查清單

在撰寫 `PRD_spec.md` 時，確保包含以下核心區塊：

- [ ] **Header**: Version, Status, Author, Last Updated
- [ ] **Problem Statement**: 問題描述與背景
- [ ] **User Stories**: 使用 US-XX 格式編號
- [ ] **Functional Requirements**: 使用 FR-XX 格式編號 (EARS syntax)
- [ ] **Acceptance Criteria**: 每個 FR 必須有對應的 AC (Given-When-Then)
- [ ] **Out of Scope**: 明確定義不做的範圍

---

## Acceptance Criteria 範例

```gherkin
# AC for FR-01
Given 使用者已登入系統
And 書籤數量大於 0
When 使用者點擊「匯出」按鈕
Then 系統應產生 JSON 檔案
And 檔案包含所有書籤資料
```

---

## EARS Syntax 快速參考

| Pattern | Format | Example |
|---------|--------|---------|
| **Ubiquitous** | The system shall [response]. | The system shall display a loading indicator. |
| **Event-driven** | When [trigger], the system shall [response]. | When user clicks save, the system shall persist data. |
| **State-driven** | While [state], the system shall [response]. | While offline, the system shall queue requests. |
| **Optional** | Where [feature], the system shall [response]. | Where dark mode is enabled, the system shall use dark colors. |
| **Unwanted** | If [condition], then the system shall [response]. | If input is invalid, then the system shall show error. |

---

## 版本控制

PRD 進入 **Frozen** 狀態後，任何變更需透過 Change Request 流程：

1. 建立新版本 (e.g., v1.0 → v1.1)
2. 在 Revision History 中記錄變更
3. 重新取得 Reviewer 核准
