---
description: "Entry point for the tiered Spec-Driven Development (SDD) workflow. Triage the change into T0/T1/T2, then follow the matching path."
---

# SDD Process Workflow

此 Workflow 是分級 SDD 的執行入口。**流程細節以 `.agent/skills/sdd/SKILL.md` 為單一事實來源**；此處只列執行步驟。

## 1. Triage (分級判定)

對照 sdd skill 的分級表，向 User 提出層級與一句理由（User 可覆寫）：

| 層級 | 適用 | 產出 |
|---|---|---|
| **T0** | typo／文案／註解／樣式微調／依賴更新／根因明顯的單點小修 | 無 spec |
| **T1**（預設） | 一般 bug fix、小～中型功能、局部重構 | 單檔 `SPEC.md` |
| **T2** | storage schema／manifest 權限／跨 context 協定／資料遺失風險邏輯／大型功能面／大規模重構 | `PRD_spec.md` + `SA_spec.md` |

## 2a. T0 Path

直接實作。commit body（繁中）交代背景與原因，不建 spec 目錄。

## 2b. T1 Path

1. 建立目錄（ID 規則見 sdd skill）：
```bash
mkdir -p docs/specs/{type}/{ID-PREFIX}_{description}
```
2. 調查 → 實作 → 補完 `SPEC.md`（骨架見 sdd skill；順序自由，可先寫後做）。
3. PR 連同 `SPEC.md` 一起送審 — **送審時 spec 必須完整**。

## 2c. T2 Path

1. **Initialization**: 確認 Issue ID 與分類，建立目錄：
```bash
mkdir -p docs/specs/feature/ISSUE-123_tab-groups
```
2. **PRD**: 撰寫 `PRD_spec.md`（參考 `.agent/skills/prd/SKILL.md`，**務必包含 Acceptance Criteria**）→ 請求 User 審閱 → **Approved**。
3. **SA**: 撰寫 `SA_spec.md`（參考 `.agent/skills/sa/SKILL.md`，**務必包含 Traceability Matrix 與 Test Impact**）→ 請求 User 審閱 → **Approved**。
4. **Implementation**: 依 Spec 實作。⚠️ 設計需變更時：🛑 暫停 Coding → 🔄 更新 Spec（升版本號）→ ✅ 核准後繼續。
5. **Verification**: 對照 PRD 的 Acceptance Criteria 驗收，在 PR Description 回報結果。

## 3. Wrap-up (各層級通用)

- Spec 與最終實作一致（Living Documentation）。
- PR description 引用 spec 路徑（T1/T2）。
