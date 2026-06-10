# SDD Phase 3: Implementation Tasks

> 此文件為 SDD 流程的 Phase 3 快速參考指南。

## 📚 相關資源

- **PRD Skill**: [`.agent/skills/prd/SKILL.md`](../../prd/SKILL.md)
- **SA Skill**: [`.agent/skills/sa/SKILL.md`](../../sa/SKILL.md)
- **Commit Helper**: [`.agent/skills/commit-message-helper/SKILL.md`](../../commit-message-helper/SKILL.md)
- **PR Skill**: [`.agent/skills/pull-request/SKILL.md`](../../pull-request/SKILL.md)

---

## 實作前置條件

> **⚠️ 重要（僅 T2 完整流程適用）**: T2 的實作階段只能在 PRD 和 SA 都進入
> **Approved** 或 **Frozen** 狀態後才能開始。
> T1 輕量案件無事前 gate — `SPEC.md` 與實作同步進行、隨 PR 一起審
> （分級判準見 `.agent/skills/sdd/SKILL.md`）。

T2 動工前確認以下項目：

- [ ] PRD 已核准 (Status: Approved/Frozen)
- [ ] SA 已核准 (Status: Approved/Frozen)
- [ ] Requirement Traceability 已完成
- [ ] Test Impact Analysis 已完成

---

## Task Template

使用以下格式追蹤實作任務：

```markdown
## Implementation Tasks for [Feature Name]

**Source PRD**: `/docs/specs/{type}/{folder}/PRD_spec.md` (v1.0)
**Source SA**: `/docs/specs/{type}/{folder}/SA_spec.md` (v1.0)

### Task Summary
Total Tasks: X | Completed: Y

### Task List

- [ ] **Task 1: [Create Module]** <!-- id: 1 -->
    - **Trace**: SA 3.1 → FR-01
    - **Files**: `modules/newModule.js`
    - **Verification**: Unit test passes
    - **Dependencies**: None

- [ ] **Task 2: [Update Facade]** <!-- id: 2 -->
    - **Trace**: SA 3.2 → FR-02
    - **Files**: `modules/uiManager.js`
    - **Verification**: Integration test passes
    - **Dependencies**: Task 1
```

---

## 驗收流程

實作完成後，需進行以下驗收：

1. **對照 PRD Acceptance Criteria**
   - 執行每個 AC 的 Given-When-Then 驗證
   - 記錄驗證結果

2. **執行測試**
   ```bash
   npm test
   ```

3. **建立 Pull Request**
   - 參考 [PR Skill](../../pull-request/SKILL.md)
   - 執行 PR 驗證腳本

---

## Spec 變更處理

如果在實作過程中發現 Spec 需要調整：

1. **停止編碼**
2. **更新 SA/PRD** (建立新版本)
3. **重新取得核准**
4. **繼續實作**

> 這是 SDD 的核心原則：Spec 驅動 Code，而非 Code 驅動 Spec。
