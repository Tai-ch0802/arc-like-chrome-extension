---
name: sdd
description: 本專案標準開發流程：分級 Spec-Driven Development (SDD)。動工前先做分級判定 — T0 直接做（typo/文案/樣式微調）、T1 單檔 SPEC.md 與實作同步並隨 PR 審（一般 bug fix / 小中型功能，預設層級）、T2 完整 PRD → SA 先審後寫（storage schema / 權限 / 跨 context 協定 / 大型功能）。產出物放 /docs/specs/{type}/{ID-PREFIX}_{desc}/，目錄前綴採 ISSUE-/PR-/BASE- 三類。當使用者提到「新功能、修 bug、重構、SDD、規格驅動、要做一個 X、開新功能」時觸發。
---

# Spec-Driven Development (SDD) Skill — 分級流程

> **本文件是 SDD 流程的單一事實來源 (single source of truth)。**
> `RULE_007_SDD_WORKFLOW.md` 與 `.agent/workflows/sdd-process.md` 為摘要與入口，
> 流程細節以本文件為準；三者若有出入，以本文件為準並回頭修正另兩份。

## 核心原則

1. **Spec 與風險成比例 (Proportional Specs)**：文件的厚度應對應變更的風險與影響面，
   而不是一律套用最重的流程。低風險變更被流程拖慢，和高風險變更裸奔，是同一種失敗。
2. **Spec 是給未來的 context**：spec 的主要讀者是「之後接手的人與 AI agent」。
   寫「為什麼這樣設計、排除了哪些方案」，比堆 boilerplate 章節有價值。
3. **Living Documentation**：實作中發現設計需變更時，先更新 spec 再繼續寫 code
   （T1 隨手改；T2 需重新取得核准）。
4. **驗收可檢驗**：不論哪一級，「怎樣算做完」都必須在動工前說得出口
   （T0 在 commit message、T1/T2 在 spec 的驗收條件）。

## 分級判定（動工前第一步）

| 層級 | 適用 | 產出 | Review 時機 |
|---|---|---|---|
| **T0 直接做** | typo、文案/翻譯、註解、純樣式微調、依賴版本更新、根因明顯的單點小修 | 無 spec；commit body 把背景講清楚 | PR review |
| **T1 輕量 SPEC**（預設） | 一般 bug fix、小～中型功能、局部重構 — 影響面一份文件講得完，且未觸及 T2 升級條件 | 單檔 `SPEC.md`（骨架見下） | 隨 PR 一起審；**不設事前 gate**，spec 與實作可同步進行 |
| **T2 完整 SDD** | 觸及任一升級條件（見下） | `PRD_spec.md` + `SA_spec.md` | **兩道事前 gate**：PRD 核准 → SA 核准 → 才動工 |

### T2 升級條件（任一成立即升級）

- 變更 `chrome.storage`（local/sync）的 schema，或需要資料 migration
- 變更 `manifest.json` 的 `permissions` / `host_permissions`
- 新增或重切跨 context 通訊協定（background ↔ sidepanel ↔ content script ↔ offscreen）
- 涉及資料遺失風險的邏輯（同步引擎、快照/還原、刪除流程）
- 新增大型使用者可見功能面（新 UI 區塊、新互動模式）
- 大規模架構重構（動到 ≥3 個 modules 的職責劃分，或新增模組層）

### 判定規則

- 由 agent 在動工前**主動提出分級與理由**（一兩句即可），使用者可隨時覆寫升降級。
- 拿不準 T1/T2 時，**問使用者一句**，不要自行猜重的或猜輕的。
- 修 bug 常要先調查才知道影響面：允許「先調查、後判級」，調查本身不需 spec。

## T1：單檔 SPEC.md 骨架

放在 `/docs/specs/{type}/{ID-PREFIX}_{desc}/SPEC.md`，1–2 頁為度：

```markdown
# {標題}

## 背景與問題
（要解什麼？bug 的話寫根因分析，不是只寫症狀）

## 方案
（怎麼解＋為什麼選這個做法；有排除的替代方案就一句帶過）

## 影響面
（動到哪些 modules / storage keys / manifest；連動風險）

## Test Impact
（unit / E2E 哪些要新增或改；驗證指令）

## 驗收條件
（可檢驗的完成定義，條列）
```

> spec 可以在實作過程中補完（例如調查完根因才寫得出「背景與問題」），
> 但 **PR 送審時 SPEC.md 必須完整**，與程式碼一起被 review。

## T2：完整流程（PRD → SA → 實作）

### Phase 1: PRD — 定義 What & Why
- **檔案**：`/docs/specs/{type}/{ID-PREFIX}_{desc}/PRD_spec.md`
- **指引**：`prd` skill（`.agent/skills/prd/SKILL.md`）；快速清單 `sdd/references/requirements.md`
- **必要內容**：User Stories、Functional Requirements（EARS）、**Acceptance Criteria（Given-When-Then）**⭐、Out of Scope
- **Gate**：User Review → Approved 後才進 Phase 2

### Phase 2: SA — 定義 How
- **檔案**：同目錄 `SA_spec.md`
- **指引**：`sa` skill（`.agent/skills/sa/SKILL.md`）；快速清單 `sdd/references/design.md`
- **必要內容**：**Requirement Traceability Matrix** ⭐、Module Impact Map、Storage Schema Diff、**Test Impact Analysis** ⭐
- **Gate**：User Review → Approved 後才動工

### Phase 3: 實作與驗收
- 指引：`sdd/references/tasks.md`
- 實作中發現設計需變更：**暫停 → 更新 spec（bump 版本）→ 重新核准 → 繼續**
- 對照 PRD 的 Acceptance Criteria 驗收並回報

## 命名規範（各層級通用）

目錄：`/docs/specs/{type}/{ID_PREFIX}_{desc}/`

- **type**：`feature` / `fix`（必要時 `refactor` / `chore`）
- **ID_PREFIX**：
  - `ISSUE-{n}`：對應 GitHub Issue（標準）
  - `PR-{n}`：外部貢獻、無 Issue
  - `BASE-{n}`：歷史回溯／基礎架構（無對應 Issue）
- **desc**：簡短英文 kebab-case

```text
/docs/specs/
  ├── feature/
  │    ├── ISSUE-101_tab-groups/        # T2：PRD_spec.md + SA_spec.md
  │    └── BASE-014_quick-toggle/       # T1：SPEC.md
  └── fix/
       └── ISSUE-88_drag-ghost/         # T1：SPEC.md
```

既有目錄裡的 `PRD_spec.md` + `SA_spec.md` 為歷史文件，**不需回頭改制**。

## Agent 操作指引

1. **分級**：對照上表提出層級與一句理由；T1/T2 邊界拿不準就問。
2. **T0** → 直接做，commit body 交代背景。
3. **T1** → `mkdir -p` 建目錄；調查→實作→補完 SPEC.md（或先寫後做，順序自由）；PR 連同 spec 一起送審。
4. **T2** → 走 Phase 1–3，兩道 gate 缺一不可。
5. **收尾**：spec 與最終實作一致（Living Doc）；PR description 引用 spec 路徑。

## 相關資源

| 用途 | 檔案 |
|------|------|
| PRD 快速清單 / 完整模板 | `sdd/references/requirements.md` / `prd/references/template_comprehensive.md` |
| SA 快速清單 / 完整模板 | `sdd/references/design.md` / `sa/references/system_design_doc.md` |
| 實作階段指南 | `sdd/references/tasks.md` |
