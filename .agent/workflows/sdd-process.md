---
description: "How to execute the Spec-Driven Development (SDD) workflow for features and fixes."
---

# SDD Process Workflow

此 Workflow 用於指導 Agent 執行標準的 SDD 開發流程。

## 1. Initialization (初始化)
當 User 提出需求時，首先確認類型 (Feature or Fix) 並建立對應目錄。

```bash
# 範例: 建立 Feature 目錄
mkdir -p docs/specs/feature/YYYYMMDD_short-description
```

## 2. PRD Creation (需求定義)
1.  **Drafting**: 在該目錄下建立 `PRD_spec.md`。
2.  **Content**: 參考 `.agent/skills/prd/SKILL.md` 的指導。
3.  **Review**: 使用 `notify_user` 請求審閱。

## 3. SA Creation (系統分析)
1.  **Drafting**: 此目錄下建立 `SA_spec.md`。
2.  **Content**: 參考 `.agent/skills/sa/SKILL.md` 的指導。
3.  **Review**: 使用 `notify_user` 請求審閱。

## 4. Implementation (實作)
1.  根據文件開始編碼。
2.  確保所有變更都對應到文件中的需求。

## 5. Verification (驗證)
1.  對照 `PRD_spec.md` 中的驗收標準進行測試。
