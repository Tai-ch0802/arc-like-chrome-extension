---
name: cleanup-merged-branches
description: "Deletes local and remote git branches that have been merged into main."
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
