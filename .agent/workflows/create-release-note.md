---
description: Create a bilingual RELEASE_NOTE.md for GitHub releases.
---

# Create Release Note Workflow

Use this workflow when preparing a new GitHub release. It generates a bilingual release note and performs pre-release checks.

## 1. Get Commits Since Last Release
// turbo
```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LAST_TAG" ]; then
  echo "No previous tags found. Will include all commits."
  git log --oneline --no-merges -20
else
  echo "Last release: $LAST_TAG"
  git log $LAST_TAG..HEAD --oneline --no-merges
fi
```

## 2. Get Contributors
// turbo
```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  git log $LAST_TAG..HEAD --format='%aN' | sort -u
else
  git log --format='%aN' -20 | sort -u
fi
```

## 3. Check Manifest Version
// turbo
```bash
cat manifest.json | grep '"version"'
```
- **Action**: Compare the version with the planned release version.
- **If outdated**: Remind the user to update `manifest.json` before proceeding.

## 4. Check Makefile File Inclusions
- **Action**: Verify if any newly added or renamed files in the git diff need to be added to the `Makefile` (e.g., `DEV_SRC_FILES` or `PROD_STATIC_FILES`).
- **Context**: Missing files in the `Makefile` will cause them to be excluded from the release zip. Remind the user or update it automatically if discrepancies are found.

## 5. Check Documentation Needs
Analyze the commit messages:
- If any `feat:` commits add user-facing features:
  1. Use the `update-multilingual-docs` skill to update documentation.
  2. Commit the documentation changes before generating the release note.

## 6. Generate RELEASE_NOTE.md
Use the `release-notes` skill to:
1. Categorize commits by type (`feat:` vs others).
2. Format them in the bilingual template.
3. Include contributor attributions with PR links where available.
4. Write to `RELEASE_NOTE.md` in project root.

## 7. Present to User
Notify the user with:
- The generated `RELEASE_NOTE.md` for review.
- Any warnings (e.g., manifest version not updated).
- Any documentation updates made.

## Notes
- `RELEASE_NOTE.md` is for preview only and should NOT be committed to git.
- The content should be copy-pasted into GitHub's release form.
