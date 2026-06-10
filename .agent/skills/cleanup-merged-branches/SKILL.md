---
name: cleanup-merged-branches
description: 清理已合併進 main 的本地與遠端 git 分支。本專案採 squash merge，PR 合併後特性分支可直接刪除。當使用者提到「清理分支、cleanup branches、刪除舊分支、清掉已合併分支、整理 branch」時觸發。
---

# Cleanup Merged Branches

This skill safely deletes git branches whose PRs have been merged into main.

> ⚠️ **本專案採 squash merge — `git branch --merged main` 偵測不到已合併分支！**
> Squash merge 會把分支 commits 壓成 main 上的一個全新 commit，分支自身的
> commit 永遠不會成為 main 的 ancestor，所以 `--merged` 永遠列不出它們、
> `git branch -d` 也會誤報 "not yet merged" 而拒刪。
> **必須以 GitHub PR 的合併狀態為準**（`gh` CLI），確認後用 `-D` 刪除。

## Procedure

### 1. Fetch and Prune Remote
```bash
git fetch --prune
```
（repo 若已啟用 "Automatically delete head branches"，遠端分支在 merge 後自動刪除，prune 會一併清掉本地的 remote-tracking refs。）

### 2. Get Merged PR Head Branches (source of truth)
```bash
gh pr list --state merged --limit 100 --json headRefName --jq '.[].headRefName' | sort -u
```

### 3. Preview Deletable Local Branches
列出本地分支（排除 `main` 與當前分支），取與步驟 2 清單的交集，先向使用者展示將刪除哪些：
```bash
git for-each-ref refs/heads --format='%(refname:short)' | grep -vx main
```

### 4. Delete Local Branches (confirmed merged via PR)
```bash
# squash merge 下必須用 -D；安全性由步驟 2 的 PR merged 狀態保證
git branch -D <branch-name>
```

### 5. Delete Leftover Remote Branches (rare)
僅在 auto-delete 未啟用或失效時需要：
```bash
git push origin --delete <branch-name>
```

## Safety Notes

- **以 PR 狀態為準**：只刪在步驟 2 清單中的分支；不在清單者一律向使用者確認後才動。
- **`-D` 的安全前提**：squash merge 使 `-d` 永遠失效；`-D` 僅可用於已確認 PR merged 的分支。
- **Never delete `main`** — 過濾須排除 main 與當前分支（`git branch --show-current`）。
- **Confirm with user** before deleting remote branches (destructive action)。
- **Fallback（gh 不可用時）**：以 `git log --oneline -20 main` 確認該分支的 squash commit（subject 帶 `(#PR號)`）已在 main 上，再行刪除。

## 本專案約定

- **Main branch**：`main`（不是 `master`）。
- **Merge 策略**：採 **squash merge**，PR 合併後特性分支歷史會被壓縮，特性分支可立即刪除。
- **GitHub 自動刪除**：若 repo 設定已啟用 "Automatically delete head branches"，遠端分支會在 squash merge 後自動清除，本 skill 主要處理「本機殘留」與「未啟用自動刪除時的補救」。
- **SOP 對照**：詳細流程參考 `.agent/workflows/cleanup-branches.md`（含 cherry-pick 與 cleanup 衝突處理）。
- **與其他 worktree 共存**：執行前先 `git worktree list`，避免刪除仍在使用中的分支。
