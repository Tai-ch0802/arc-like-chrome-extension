---
description: Delete local and remote git branches merged into main.
---

# Cleanup Merged Branches Workflow

Use this workflow to clean up branches that have been merged into main.

## 1. Fetch and Prune
// turbo
```bash
git fetch --prune
```

## 2. Preview Local Merged Branches
// turbo
```bash
git branch --merged main | grep -v "main" | grep -v "^\*"
```

## 3. Preview Remote Merged Branches
// turbo
```bash
git branch -r --merged main | grep -v "main" | grep -v "HEAD" | sed 's/origin\///'
```

## 4. Delete Local Merged Branches
```bash
git branch --merged main | grep -v "main" | grep -v "^\*" | xargs -r git branch -d
```

## 5. Delete Remote Merged Branches
For each branch from step 3, run:
```bash
git push origin --delete <branch-name>
```

Or delete all at once (use with caution):
```bash
git branch -r --merged main | grep -v "main" | grep -v "HEAD" | sed 's/origin\///' | xargs -I {} git push origin --delete {}
```

## 6. Notify User
Report which branches were deleted (local and remote).
