---
description: PR Review 標準作業程序
---

# PR Review 指南

本文件規範 AI Agent 進行 Pull Request Review 時的標準作業程序。

## 1. 工具使用

必須使用 GitHub CLI (`gh`) 進行 Review 提交。

- **指令**: `gh pr review <PR_NUMBER> --comment --body-file <COMMENT_FILE>`
- **Action**: 一律使用 `--comment` (不使用 Approve 或 Request Changes，除非使用者特別指定)。

## 2. 語言規範

- **Review 內文**: 必須使用**繁體中文 (zh-TW)**。
- **程式碼引用/技術術語**: 可保留英文 (如 Function Name, Variable Name)。

## 3. 簽名檔 (Signature)

所有 Comment 必須在末尾加上以下簽名：

```
---
created by antigravity agent
```

## 4. 檢查重點

- **功能性**: 程式碼是否符合需求？
- **規範性**: 是否違反 `AGENTS.md` 或其他 Rule (如 DRY, I18n)？
- **安全性**: 是否有潛在安全漏洞？
- **可讀性**: 變數命名、註解是否清晰？

## 5. 流程範例

1.  確認 PR 內容與 Diff。
2.  撰寫 Review 內容至暫存檔 (e.g., `pr_review_temp.md`)。
3.  執行 `gh` 指令提交。
4.  刪除暫存檔。
