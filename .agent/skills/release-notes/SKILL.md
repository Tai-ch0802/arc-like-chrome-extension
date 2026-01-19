---
name: release-notes
description: "Generates bilingual (zh-TW/en) RELEASE_NOTE.md for GitHub releases."
---

# Release Notes Generation

This skill generates a `RELEASE_NOTE.md` file for GitHub releases. The note is bilingual (Traditional Chinese and English) and includes contributor credits.

## Output File

- **Path**: `RELEASE_NOTE.md` (project root)
- **Format**: Bilingual markdown with Traditional Chinese first, then English

## Template Structure

```markdown
# v{VERSION} Release Notes

## 繁體中文 (Traditional Chinese)

### ✨ 新功能 (New Features)
- {feature description} (#{PR_NUMBER} by @{author})

### 🚀 改善與錯誤修復 (Improvements & Bug Fixes)
- {improvement/fix description} (#{PR_NUMBER} by @{author})

### 👥 貢獻者 (Contributors)
感謝以下貢獻者！
- @{contributor1}
- @{contributor2}

---

## English

### ✨ New Features
- {feature description} (#{PR_NUMBER} by @{author})

### 🚀 Improvements & Bug Fixes
- {improvement/fix description} (#{PR_NUMBER} by @{author})

### 👥 Contributors
Thanks to all contributors!
- @{contributor1}
- @{contributor2}
```

## Procedure

### 1. Gather Commit Information
Run the following commands to get commits since last release:
```bash
# Get latest release tag
git describe --tags --abbrev=0

# Get commits between last tag and HEAD
git log {LAST_TAG}..HEAD --oneline --no-merges

# Get detailed diff
git diff {LAST_TAG}..HEAD --stat
```

### 2. Identify Contributors
```bash
# List all authors since last release
git log {LAST_TAG}..HEAD --format='%aN' | sort -u
```

### 3. Check Manifest Version
- Read `manifest.json` and compare `version` field with the planned release version.
- If version is NOT updated, **remind the user** to update it before publishing.

### 4. Check Documentation Updates
- Analyze the changes to determine if new features were added.
- If new user-facing features exist, invoke the `update-multilingual-docs` skill to update:
  - `README.md` / `README.en.md`
  - `docs/store_description_*.md`

### 5. Generate RELEASE_NOTE.md
- Categorize commits into "New Features" vs "Improvements & Bug Fixes" based on commit prefixes:
  - `feat:` → New Features
  - `fix:`, `perf:`, `refactor:`, `style:`, `docs:`, `chore:` → Improvements & Bug Fixes
- Include PR numbers and author attributions if available from commit messages.
- Write the file to project root.

### 6. Cleanup
- `RELEASE_NOTE.md` is temporary and should be added to `.gitignore`.
- The content is meant to be copy-pasted into GitHub's release form.
