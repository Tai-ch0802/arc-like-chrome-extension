---
name: update-multilingual-docs
description: "Updates documentation (README and store descriptions) across multiple languages."
---

# Update Multilingual Documentation

This skill updates the project's documentation when new features are added or existing features are modified.

## Files to Update

1.  **Documentation Structure** (`.github/i18n/`):
    *   **En (Source)**: `.github/i18n/en/{README,CONTRIBUTING,etc}.md`
    *   **Translations**: `.github/i18n/{lang_code}/{filename}.md`
    *   **Root**: Files in root should be Symlinks to `i18n/en/`.
3.  **Store Descriptions** (`docs/chrome-web-store/`):
    *   `store_description_*.md` (14 languages)

## Procedure

### 1. Analyze the Change
*   Identify the source content (usually in English from a Spec file).
*   Determine the insertion point.

### 2. Update English Source
*   Edit `.github/i18n/en/README.md` (or other target file).
*   Insert the new content.

### 3. Sync Root (Symlinks)
*   Ensure root files (`README.md`, `CONTRIBUTING.md`) are valid symlinks pointing to `i18n/en/`.
*   *(No content copy needed if using symlinks)*

### 4. Update Multilingual Docs
*   **Iterate**: For each language folder in `.github/i18n/` (excluding `en`):
    1.  Translate the new content into the target language.
    2.  Insert at the corresponding location.

### 5. Update Store Descriptions
*   **Source**: Use `docs/chrome-web-store/store_description_en.md` as the baseline.
*   **Iterate**: For each language file in `docs/chrome-web-store/`:
    1.  Translate and insert the new content.
    2.  **Verification**: ensure emojis headers (like `⌨️`) are consistent.

### 6. Verification
*   Check that all files have been modified.
*   Run a `grep` check to ensure headers are present in all files.
