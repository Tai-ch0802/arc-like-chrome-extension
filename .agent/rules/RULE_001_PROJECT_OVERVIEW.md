---
description: 專案概述與技術棧
---

# 專案概述

這是一個 **Arc 風格的 Chrome 側邊欄擴充功能**，提供垂直分頁與書籤管理。

## 專案類型
Chrome Extension (Manifest V3)

## 技術棧

### Framework
- Chrome Manifest V3

### Frontend
- Vanilla JavaScript (ES6+)
- HTML5
- CSS3

### Chrome APIs
- `chrome.sidePanel`、`chrome.tabs`、`chrome.tabGroups`、`chrome.bookmarks`
- `chrome.i18n`、`chrome.storage`、`chrome.readingList`
- `chrome.alarms`（RSS 排程）、`chrome.scripting`（頁面內容擷取）
- `chrome.offscreen`、`chrome.identity`（Google Drive 同步 OAuth）
- 本機 AI：`LanguageModel`（Prompt API）與 `Summarizer` API（Gemini Nano，on-device）

### JS Libraries
- Sortable.js（唯一的執行期第三方函式庫；嚴禁引入 UI 框架）

### Build & Test Tools
- make（需要 `jq` 讀取版本號；prod build 用 esbuild bundle/minify）
- Jest + Puppeteer（E2E 在 `usecase_tests/puppeteer_tests/`、單元測試在 `usecase_tests/unit_tests/`）

## 標籤
`chrome-extension`, `javascript`, `vanilla-js`, `manifest-v3`, `sidebar`
