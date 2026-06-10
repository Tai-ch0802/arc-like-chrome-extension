---
trigger: always_on
---

# RULE_007_SDD_WORKFLOW

## 1. 核心原則 (Core Principles)

本專案採用 **分級 Spec-Driven Development (SDD)**。

1. **Spec 與風險成比例 (Proportional Specs)**：動工前先做分級判定；文件厚度對應變更的風險與影響面。
2. **Living Documentation**：程式碼與規格必須同步。實作中發現設計需變更，**先更新規格**再改 code（T2 需重新核准）。

> **單一事實來源**：流程細節（分級判準、SPEC.md 骨架、T2 各 Phase 內容）以
> `.agent/skills/sdd/SKILL.md` 為準。本 RULE 僅保留一眼可查的摘要。

## 2. 分級摘要 (Tier Summary)

| 層級 | 適用 | 產出 | Gate |
|---|---|---|---|
| **T0 直接做** | typo／文案／註解／樣式微調／依賴更新／根因明顯的單點小修 | 無 spec（commit body 交代背景） | PR review |
| **T1 輕量 SPEC**（預設） | 一般 bug fix、小～中型功能、局部重構 | 單檔 `SPEC.md` | 隨 PR 一起審，無事前 gate |
| **T2 完整 SDD** | storage schema／manifest 權限／跨 context 協定／資料遺失風險邏輯／大型功能面／大規模重構 | `PRD_spec.md` + `SA_spec.md` | PRD 核准 → SA 核准 → 才動工 |

分級由 agent 主動提出、使用者可覆寫；T1/T2 拿不準時詢問使用者。

## 3. 文件規範 (Documentation Standards)

所有規格文件存放於 `/docs/specs/{type}/{ID_PREFIX}_{desc}/`：

- **type**：`feature` / `fix`（必要時 `refactor` / `chore`）
- **ID_PREFIX**：`ISSUE-{n}`（標準）／`PR-{n}`（外部貢獻）／`BASE-{n}`（基底/回溯）
- **desc**：簡短英文 kebab-case（e.g., `bookmark-sync`）
- **檔名**：T1 → `SPEC.md`；T2 → `PRD_spec.md`（含 User Stories + **Acceptance Criteria**）與 `SA_spec.md`（含 Architecture + **Traceability Matrix** + **Test Impact**）

## 4. T2 工作流程 (Full Workflow)

1. **Requirement**：建目錄 → 撰寫 `PRD_spec.md` → **User Review (Approved)**
2. **Analysis**：撰寫 `SA_spec.md` → **User Review (Approved)**
3. **Implementation**：依 Spec 實作；⚠️ 設計需變更時 → 暫停 → 更新 Spec（bump 版本）→ 核准 → 繼續
4. **Verification**：對照 PRD Acceptance Criteria 驗收並回報
