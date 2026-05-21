---
name: cleanup-merged-branches
description: 清理已合併進 main 的本地與遠端 git 分支。本專案採 squash merge，PR 合併後特性分支可直接刪除。當使用者提到「清理分支、cleanup branches、刪除舊分支、清掉已合併分支、整理 branch」時觸發。
---

# Cleanup Merged Branches

This skill safely deletes git branches that have been merged into the main branch.

## Procedure

### 1. Fetch and Prune Remote
```bash
git fetch --prune
```

### 2. List Merged Branches (Preview)
```bash
# Local branches merged into main (excluding main itself)
git branch --merged main | grep -v "main" | grep -v "^\*"

# Remote branches merged into main
git branch -r --merged main | grep -v "main" | grep -v "HEAD"
```

### 3. Delete Local Branches
```bash
git branch --merged main | grep -v "main" | grep -v "^\*" | xargs -r git branch -d
```

### 4. Delete Remote Branches
```bash
# For each remote branch (e.g., origin/feature-branch)
git push origin --delete <branch-name>
```

## Safety Notes

- **Always preview** before deleting (`-d` is safe, `-D` force deletes)
- **Never delete `main`** - the grep filters exclude it
- **Confirm with user** before deleting remote branches (destructive action)
- **Protected branches** - some branches may be protected on GitHub

## 本專案約定

- **Main branch**：`main`（不是 `master`）。
- **Merge 策略**：採 **squash merge**，PR 合併後特性分支歷史會被壓縮，特性分支可立即刪除。
- **GitHub 自動刪除**：若 repo 設定已啟用 "Automatically delete head branches"，遠端分支會在 squash merge 後自動清除，本 skill 主要處理「本機殘留」與「未啟用自動刪除時的補救」。
- **SOP 對照**：詳細流程參考 `.agent/workflows/cleanup-branches.md`（含 cherry-pick 與 cleanup 衝突處理）。
- **與其他 worktree 共存**：執行前先 `git worktree list`，避免刪除仍在使用中的分支。
