---
trigger: always_on
description: 開發準則與脈絡工程
---

# 開發準則

## 變更影響評估

在做任何改動時，需要留意是否可能影響其他的檔案。並且時刻留意此次的改動項目，必要時在 `GEMINI.md` 上調整專案 `key_files` 的描述及調整。

### 檢查清單

- [ ] 此變更是否影響其他模組？
- [ ] 是否需要更新 `GEMINI.md` 的 `key_files` 描述？
- [ ] 是否需要更新相關的測試？

## Context Engineering (脈絡工程)

在一個開發 session 結束時，應將當次所有變動內容進行摘要，並儲存至 `.gemini/NOTE_YYYYMMDD.md` 檔案中，以作為未來開發的脈絡參考。

### 摘要模板

```markdown
# 開發摘要 - YYYY-MM-DD

## 變更項目
- [檔案1]: 描述變更內容
- [檔案2]: 描述變更內容

## 技術決策
- 決策1的背景與理由

## 待辦事項
- [ ] 後續需要處理的項目
```

## 偏好語言

與 AI 助手互動時，偏好使用**繁體中文 (zh-TW)**。


## 1. Code Reusability & DRY Principle
- **No Redundant Icons**: Avoid hardcoding duplicate SVG strings or icon definitions in multiple files. Centralize all icons in `modules/icons.js` (or a similar shared module) and import them where needed. This ensures consistency and makes updates easier.

## 2. UI/UX Consistency
- **Hover Effects**: Interactive elements like edit buttons should typically be revealed on hover to reduce visual clutter, unless they are primary actions.
