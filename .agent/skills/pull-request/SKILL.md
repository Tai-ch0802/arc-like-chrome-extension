---
name: pull-request
description: "Guidelines and tools for creating high-quality Pull Requests using the gh CLI. Includes bilingual templates (zh-TW/en) and validation scripts."
---

# Pull Request Skill

本技能提供建立高品質 Pull Request 的完整指南與工具。

## 核心原則

1.  **雙語描述 (Bilingual Description)**: PR 描述必須同時包含原始語言 (zh-TW) 與英文版本。
2.  **使用 `gh` CLI**: 優先使用 GitHub CLI (`gh`) 建立 PR，確保一致性與可自動化。
3.  **預先驗證 (Pre-validation)**: 在提交 PR 前，使用驗證腳本檢查內容完整性。

## Skill 結構

```
.agent/skills/pull-request/
├── SKILL.md              # 本文件
├── references/
│   ├── pr_template.md    # PR 描述樣板
│   └── checklist.md      # PR 提交前檢查清單
└── scripts/
    └── check-pr.sh       # PR 內容驗證腳本
```

## 如何建立 Pull Request

### Step 1: 確保變更已 Commit

```bash
git status
git add .
git commit -m "type(scope): description"
```

### Step 2: 推送分支

```bash
git push -u origin <branch-name>
```

### Step 3: 執行 PR 驗證腳本

在建立 PR 前執行驗證腳本，確保：
- 分支已推送到遠端
- 有 commit 差異
- 測試通過 (可選)

```bash
# 執行驗證腳本
./.agent/skills/pull-request/scripts/check-pr.sh
```

### Step 4: 使用 `gh` 建立 PR

```bash
# 基本用法 (互動模式)
gh pr create

# 指定標題和描述 (非互動模式)
gh pr create --title "feat(scope): 功能描述" --body-file .github/pull_request_template.md

# 指定 base branch
gh pr create --base main --title "fix(ui): 修復問題" --body "PR 內容"

# 設定 Draft PR
gh pr create --draft --title "wip: 進行中的功能"

# 指定 Reviewer
gh pr create --reviewer user1,user2

# 指定 Labels
gh pr create --label "enhancement,documentation"
```

### Step 5: 完成 PR 描述

PR 描述應遵循 `references/pr_template.md` 的格式：

1.  **摘要 (Summary)**: 簡述此 PR 的目的。
2.  **變更內容 (Changes)**: 列出主要變更項目。
3.  **測試 (Testing)**: 說明如何測試這些變更。
4.  **英文版 (English Version)**: 提供完整的英文描述。

## `gh` CLI 常用指令

### 建立 PR

```bash
gh pr create [flags]
```

常用 flags:
- `--title`, `-t`: PR 標題
- `--body`, `-b`: PR 內容
- `--body-file`, `-F`: 從檔案讀取 PR 內容
- `--base`, `-B`: 目標分支 (預設: main)
- `--head`, `-H`: 來源分支
- `--draft`, `-d`: 建立 Draft PR
- `--reviewer`, `-r`: 指定 Reviewer
- `--assignee`, `-a`: 指定 Assignee
- `--label`, `-l`: 加入 Labels
- `--web`, `-w`: 在瀏覽器中開啟建立頁面

### 查看 PR

```bash
# 列出 PR
gh pr list

# 查看特定 PR
gh pr view <number>

# 在瀏覽器中開啟
gh pr view <number> --web

# 查看 PR 差異
gh pr diff <number>
```

### 管理 PR

```bash
# 合併 PR
gh pr merge <number>

# Squash 合併
gh pr merge <number> --squash

# Rebase 合併
gh pr merge <number> --rebase

# 關閉 PR
gh pr close <number>

# 重新開啟 PR
gh pr reopen <number>

# 標記為 Ready for Review
gh pr ready <number>
```

## 最佳實踐

### PR 標題格式

遵循 Conventional Commits:

```
<type>(<scope>): <description>
```

Types:
- `feat`: 新功能
- `fix`: 錯誤修復
- `docs`: 文件更新
- `style`: 格式調整
- `refactor`: 重構
- `perf`: 效能優化
- `test`: 測試相關
- `chore`: 維護任務

### PR 大小建議

- **理想**: < 400 行變更
- **可接受**: 400-800 行
- **過大**: > 800 行 (考慮拆分)

### Commit 歷史

- 保持 commit 歷史清晰
- 每個 commit 應為單一邏輯變更
- 考慮使用 `git rebase -i` 整理 commit

## 檢查清單

在建立 PR 前，確認：

- [ ] 程式碼已通過 lint 檢查
- [ ] 測試已通過 (`npm test`)
- [ ] 沒有未解決的 merge conflict
- [ ] PR 描述包含雙語版本
- [ ] 已指定適當的 Reviewer
- [ ] 已加入相關 Labels

## 參考資料

- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GitHub PR Documentation](https://docs.github.com/en/pull-requests)
- [Conventional Commits](https://www.conventionalcommits.org/)
