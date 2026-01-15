---
name: update-multilingual-docs
description: "Updates documentation (READMEs and store descriptions) across multiple languages."
---

# Update Multilingual Documentation

This skill updates the project's documentation when new features are added or existing features are modified. It ensures consistency across `README.md`, `README.en.md`, and all 14 `docs/store_description_*.md` files.

## Files to Update

1.  **READMEs**:
    *   `README.md` (Traditional Chinese - Primary)
    *   `README.en.md` (English)
2.  **Store Descriptions**:
    *   `docs/store_description_*.md` (14 languages: de, en, es, fr, hi, id, ja, ko, pt_BR, ru, th, vi, zh_CN, zh_TW)

## Procedure

### 1. Analyze the Change
*   Identify the source content (usually in English from a Spec file or `README.en.md`).
*   Determine the insertion point (e.g., "Before the Shortcuts section", "After Key Features").

### 2. Update READMEs
*   **English (`README.en.md`)**: Insert the English content.
*   **Traditional Chinese (`README.md`)**: Translate the content to Traditional Chinese and insert.
    *   *Note*: Ensure specific terms (like "Linked Tabs") are translated consistently with existing usage.

### 3. Update Store Descriptions
*   **Source**: Use `docs/store_description_en.md` as the baseline.
*   **Iterate**: For each language file in `docs/`:
    1.  Read the file to check existing structure.
    2.  Translate the new content into the target language.
        *   Use the agent's internal translation capabilities.
        *   Maintain the same formatting (headers, bullet points, bold text).
    3.  Insert the translated content at the corresponding location.
    4.  **Verification**: ensure emojis headers (like `⌨️`) are consistent.

### 4. Verification
*   Check that all files have been modified.
*   Run a `grep` check to ensure headers are present in all files.
    *   Example: `grep "## <New Header>" docs/store_description_*.md`
