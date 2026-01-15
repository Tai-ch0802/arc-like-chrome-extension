---
description: Update documentation across all languages after a feature release.
---

# Update Documentation Workflow

Use this workflow when you have introduced a new feature and need to document it in the READMEs and Store Descriptions for all supported languages.

## 1. Prepare Content
Identify the detailed description of the new feature in English. This is usually found in a `docs/feat-spec/*.md` file or can be drafted freshly.

*   **English Content**: (Paste or reference the content here)
*   **Placement**: (e.g., "Before the Shortcuts section")

## 2. Update READMEs
// turbo
Run the following command to verify the current state of READMEs:
```bash
ls -l README.md README.en.md
```

Use the `update-multilingual-docs` skill to update both README files.
*   Update `README.en.md` with the English content.
*   Update `README.md` with the Traditional Chinese translation.

## 3. Update Store Descriptions
// turbo
Run the following command to list all store description files:
```bash
ls docs/store_description_*.md
```

Use the `update-multilingual-docs` skill to iterate through all listed files.
*   Translate the English content into each target language.
*   Insert the content at the specified placement.

## 4. Verify Updates
// turbo
Run a grep check to ensure the new section header exists in all store description files. Replace "New Header Keyword" with a unique word from your new header (e.g., "Keyboard").
```bash
grep -c "New Header Keyword" docs/store_description_*.md
```
*   Ensure all files return a count of `1` (or more, if applicable).
