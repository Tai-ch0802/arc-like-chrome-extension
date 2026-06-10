---
name: commit-message-helper
description: 本專案 (Manifest V3 Chrome extension) 的 commit 規範與範例：subject 使用英文 Conventional Commits、body 使用繁中說明背景與原因。當使用者提到「commit、提交訊息、commit message、寫 commit、commit 規範」時觸發。
---

# Commit Message Helper

When writing commit messages, follow these rules:

## Format

<type>(<scope>): <subject>

<body>

<footer>

## Types

- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding missing tests or correcting existing tests
- chore: Changes to the build process or auxiliary tools

## Guidelines

1. Subject line should be no longer than 50 characters
2. Use imperative mood ("add feature" not "added feature")
3. Do not end the subject line with a period
4. Separate subject from body with a blank line
5. Use the body to explain what and why, not how
6. **Subject in English** (Conventional Commits); **body in Traditional Chinese (zh-TW)** — see「本專案約定」below

## Examples

Good:
refactor(sidepanel): modularize sidepanel.js into single-purpose modules

此次提交將原先龐大的 `sidepanel.js` 重構成多個職責單一的模組，旨在改善程式碼結構、可讀性，並簡化未來的開發流程。
核心邏輯現已拆分至 `modules/` 目錄下的多個模組：

- **`apiManager.js`**: 作為服務層，封裝了所有與 Chrome 擴充功能 API (`chrome.*`) 的互動。這將 API
      呼叫集中管理，使其更易於維護和模擬測試。
- **`stateManager.js`**: 管理 UI 相關的狀態，例如書籤資料夾的展開狀態。這避免了污染全域作用域，並提供了清晰的狀態管理函式。
- **`uiManager.js`**: 處理所有 DOM 操作與畫面渲染。它接收資料並負責呈現，但本身不包含任何業務邏輯。
- **`dragDropManager.js`**: 包含所有與 SortableJS 函式庫相關的邏輯，管理分頁和書籤的拖放功能。
- **`searchManager.js`**: 封裝了由使用者在搜尋框中輸入觸發的搜尋與過濾邏輯。

主要的 `sidepanel.js` 腳本現在作為一個高層級的協調者。其唯一職責是初始化所有模組，並協調它們之間的資料流與事件。

**其他變更：**
- `sidepanel.html` 已更新，將 `sidepanel.js` 作為 `type="module"` 載入。
- `Makefile` 已更新，將新的 `modules/` 目錄包含在最終的打包檔案中。
- `GEMINI.md` 已更新，以反映新的模組化架構。

Bad:
updated stuff

## 本專案約定

- **Subject 語言**：英文（沿用 `GEMINI.md` 既有規範），body 繁中。subject 50 字內、imperative mood、不加句號。
- **Scope 命名建議**：`sidepanel`、`modules/ui`、`modules/utils`、`modules/api`、`background`、`manifest`、`i18n`、`tests`、`makefile`、`docs`。
- **Body 內容**：說明「為什麼改」與「實作關鍵」，不要只寫「what」。改動到 `key_files`（如 `sidepanel.js`、`modules/ui/elements.js`）時，body 提醒一句「同步更新 GEMINI.md key_files 描述」。
- **Footer**：若對應 Issue / PR，加 `Closes #123` 或 `Refs #123`。
- **多 commit 一份 PR**：合併採 squash merge，PR title 仍要遵守同規範（會成為最終 commit subject）。
