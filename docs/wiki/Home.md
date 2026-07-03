# Arc-Style Chrome Sidebar — 專案 Wiki

歡迎！這裡是 **arc-like-chrome-extension** 的開發者文件，內容給人類閱讀，也是 AI agent 的參考資料之一。

> 📌 **本 Wiki 的原始檔管理在主 repo 的 [`docs/wiki/`](https://github.com/Tai-ch0802/arc-like-chrome-extension/tree/main/docs/wiki)**，
> merge 進 `main` 後由 GitHub Actions 自動同步到這裡。
> **請勿直接在 Wiki UI 編輯**（會被下一次同步覆蓋）；修改請對 `docs/wiki/` 發 PR。

## 這是什麼專案？

一個 Manifest V3 Chrome 擴充功能，在側邊欄提供 Arc 瀏覽器風格的垂直分頁管理，整合：

- **分頁 + 書籤 + 閱讀清單**的統一面板，含 Linked Tabs（書籤↔分頁雙向關聯、防重複開分頁）
- **本機 AI**（Chrome 內建 Gemini Nano，零設定、零 API key）：群組自動命名、分頁清理建議、hover 摘要、自然語言搜尋
- **Workspaces**：分頁快照儲存/還原，metadata 跨裝置同步，可選 Google Drive 備份
- **Spotlight 搜尋**（Cmd/Ctrl+Shift+K 置中彈窗）
- **Bookmark Tools**：多標籤、重複書籤清理、死連結掃描

技術棧：Vanilla JavaScript (ES6+)、無 UI 框架、唯一執行期依賴 Sortable.js。

## 頁面索引

| 頁面 | 內容 |
|---|---|
| [Architecture](Architecture) | 執行 context、模組地圖、架構不變式、storage schema 慣例 |
| [Development Workflow](Development-Workflow) | 分級 SDD 流程、commit/PR 規範、建置與發布 |
| [Testing Guide](Testing-Guide) | 測試結構、指令、命名規則、CI 穩定性方針 |
| [AI Agent Harness](AI-Agent-Harness) | 本專案的 AI agent 制度：設定檔、skills、rules、排程 agents |

## 快速開始（開發者）

```bash
git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
cd arc-like-chrome-extension
npm ci            # 測試依賴（Jest + Puppeteer）
make              # 打包開發版 zip（需要 jq）
npm run test:ci   # happy-path E2E 快驗
```

本機載入：`chrome://extensions` → 開發人員模式 → 「載入未封裝的項目」→ 選專案根目錄。

## 相關連結

- [Chrome Web Store 頁面](https://sidebar-for-tabs-bookmarks.taislife.work/)（官方網站含安裝連結與 changelog）
- [Issues](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues) / [Releases](https://github.com/Tai-ch0802/arc-like-chrome-extension/releases)
- 貢獻指南：`.github/i18n/{語言}/CONTRIBUTING.md`
