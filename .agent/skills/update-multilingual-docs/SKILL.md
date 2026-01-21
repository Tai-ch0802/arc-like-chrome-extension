---
name: update-multilingual-docs
description: "Updates documentation (README and store descriptions) across multiple languages."
---

# Update Multilingual Documentation

This skill updates the project's documentation when new features are added or existing features are modified.

## Files to Update

1.  **READMEs** (`.github/readme/`):
    *   `README.en.md` (English - **Source**)
    *   `README.zh_TW.md`, `README.zh_CN.md`, etc. (13 other languages)
2.  **Root README**:
    *   `README.md` (Should strictly match `.github/readme/README.en.md`)
3.  **Store Descriptions** (`docs/chrome-web-store/`):
    *   `store_description_*.md` (14 languages)

## Procedure

### 1. Analyze the Change
*   Identify the source content (usually in English from a Spec file).
*   Determine the insertion point.

### 2. Update English README
*   Edit `.github/readme/README.en.md`.
*   Insert the new content.

### 3. Update Root README
*   Copy the content of `.github/readme/README.en.md` to `README.md` (or simply ensure they are synced).

### 4. Update Multilingual READMEs
*   **Iterate**: For each `README.*.md` in `.github/readme/` (excluding `en`):
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
