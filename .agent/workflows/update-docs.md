---
description: Update documentation across all languages after a feature release.
---

# Update Documentation Workflow

Use this workflow when you have introduced a new feature and need to document it in the READMEs and Store Descriptions for all supported languages.

## 1. Prepare Content
Identify the detailed description of the new feature from your `PRD_spec.md`.

*   **Source Spec**: Reference your `docs/specs/{type}/{folder}/PRD_spec.md`.
*   **English Content**: Extract the English description or User Stories here.
*   **Placement**: (e.g., "Before the Shortcuts section")

## 2. Update GitHub READMEs
// turbo
Run the following command to list all README files:
```bash
ls .github/readme/README.*.md
```

Use the `update-multilingual-docs` skill to update these files:

1.  **Update English Source**: Add content to `.github/readme/README.en.md`.
2.  **Sync Root**: Overwrite `README.md` with the updated `.github/readme/README.en.md` content.
3.  **Translate & Update Others**: Update the remaining 13 language files in `.github/readme/` with translated content.

## 3. Update Store Descriptions
// turbo
Run the following command to list all store description files:
```bash
ls docs/chrome-web-store/store_description_*.md
```

Use the `update-multilingual-docs` skill to iterate through all listed files:
*   Translate the English content into each target language.
*   Insert the content at the specified placement.

## 4. Verify Updates
// turbo
Run a grep check to ensure the new section header exists in all relevant files. Replace "New Header" with your keyword.

**Check READMEs:**
```bash
grep -c "New Header" .github/readme/README.*.md
```

**Check Store Docs:**
```bash
grep -c "New Header" docs/chrome-web-store/store_description_*.md
```
*   Ensure all counts are correct.
