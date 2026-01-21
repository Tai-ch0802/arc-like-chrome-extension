---
description: "How to execute the Spec-Driven Development (SDD) workflow for features and fixes."
---

# SDD Process Workflow

此 Workflow 用於指導 Agent 執行標準的 SDD 開發流程。

## 1. Initialization (初始化)
當 User 提出需求時，首先確認對應的 **Issue ID** 與分類 (Feature or Fix)，並建立目錄。

```bash
# 格式: {ISSUE-ID}_{description}
# 範例: 建立 Feature 目錄 for Issue #123
mkdir -p docs/specs/feature/ISSUE-123_tab-groups
```

## 2. PRD Creation (需求定義)
1.  **Drafting**: 在該目錄下建立 `PRD_spec.md`。
2.  **Content**: 參考 `.agent/skills/prd/SKILL.md` 的指導，**務必包含 Acceptance Criteria**。
3.  **Review**: 使用 `notify_user` 請求審閱。

## 3. SA Creation (系統分析)
1.  **Drafting**: 此目錄下建立 `SA_spec.md`。
2.  **Content**: 參考 `.agent/skills/sa/SKILL.md` 的指導，**務必包含 Traceability Matrix**。
3.  **Review**: 使用 `notify_user` 請求審閱。

## 4. Implementation (實作)
1.  **Pre-Code Check**: 確認 PRD 與 SA 皆標記為 **Approved/Frozen**。
2.  **Coding**: 根據文件開始編碼。
3.  **Living Doc Sync**: ⚠️ **關鍵步驟**
    *   如果在實作過程中發現設計不可行或需要變更：
    *   🛑 **暫停 Coding**
    *   🔄 **更新 SA/PRD** (升級版本號)
    *   ✅ **取得核准後再繼續**

## 5. Verification (驗證)
1.  **Test**: 對照 `PRD_spec.md` 中的 Acceptance Criteria 進行測試。
2.  **Report**: 在 PR Description 或 Ticket 中回報驗收結果 (Pass/Fail)。