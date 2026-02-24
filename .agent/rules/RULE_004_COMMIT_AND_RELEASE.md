---
description: Commit Message 與 Release Note 撰寫規範
---

# Commit 與 Release 規範

## Commit Message 規範

請遵循 **Conventional Commits** 規範。

### 格式

```
<type>(<scope>): <subject>

<body>
```

### 語言規則

- **Subject (第一行)**: 必須使用**英文**
- **Body (內文)**: 應使用**繁體中文**，詳細說明改動的背景、原因和實現細節

### 範例

```
feat(tabs): add split view support

新增分割畫面支援功能，讓使用者可以在側邊欄中看到分割視窗的分頁群組。
此功能依賴 Chrome 140+ 的 splitViewId 屬性。
```

## Release Note 規範

撰寫 release note 時，請遵循 `.github/release.yml` 中定義的結構與風格。

### 區塊結構

- **✨ 新功能 (New Features)**
- **🚀 改善與錯誤修復 (Improvements & Bug Fixes)**

### 語言

語言應以**繁體中文**為主。

### 注意事項

- **打包檔案檢核**: 由於過去曾發生漏打包的問題，撰寫 release note 或是發布前，務必檢核新建立或是重新命名的檔案是否已經正確加入到 `Makefile` 的 `DEV_SRC_FILES` 或其他編譯設定當中。
- 產出的 `RELEASE_NOTE.md` 檔案僅為臨時預覽用途，應被加入 `.gitignore` 中，不進入版控。
