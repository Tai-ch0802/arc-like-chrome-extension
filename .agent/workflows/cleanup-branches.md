---
description: Delete local and remote git branches whose PRs were merged (squash) into main.
---

# Cleanup Merged Branches Workflow

Use this workflow to clean up branches whose PRs have been merged into main.

> ⚠️ 本專案採 **squash merge**：`git branch --merged main` 永遠偵測不到已合併的
> 特性分支（squash commit 是 main 上的新 commit，分支 commit 不會成為 ancestor），
> `git branch -d` 也會誤報拒刪。**以 GitHub PR 的 merged 狀態為準，確認後用 `-D`。**

## 1. Fetch and Prune
// turbo
```bash
git fetch --prune
```

## 2. Get Merged PR Head Branches (source of truth)
// turbo
```bash
gh pr list --state merged --limit 100 --json headRefName --jq '.[].headRefName' | sort -u
```

## 3. Preview Local Branches
// turbo
```bash
git for-each-ref refs/heads --format='%(refname:short)' | grep -vx main
```

取步驟 2 與步驟 3 的交集 = 可安全刪除的本地分支；向使用者列出後再執行刪除。

## 4. Delete Local Branches (confirmed merged via PR)
For each branch in the intersection:
```bash
git branch -D <branch-name>
```

## 5. Delete Leftover Remote Branches (rare)
通常 repo 的 "Automatically delete head branches" 已在 merge 時刪除遠端分支。
僅在仍殘留時（`git branch -r` 還看得到、且在步驟 2 清單中）執行：
```bash
git push origin --delete <branch-name>
```

## 6. Notify User
Report which branches were deleted (local and remote), and which were skipped (not found in merged PR list).
