---
name: update-multilingual-docs
description: 同步本專案多語系文件：.github/i18n/{lang}/{README,CONTRIBUTING}.md（根目錄為 symlink 指向 en/）與 docs/chrome-web-store/store_description_*.md (14 種語言)。當使用者提到「多語系、i18n 文件、翻譯文件、更新 README 多語、store description、Chrome Web Store 描述」時觸發。
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
