# Claude Code Project Guide — arc-like-chrome-extension

> **主要文件指向**：請先讀 `AGENTS.md`（含 Quick Start、Skill / Workflow / Rules 索引）
> 與 `.agent/rules/RULE_002_ARCHITECTURE.md`、`.agent/rules/RULE_006_PR_REVIEW_GUIDELINES.md`。
> 本檔僅補充 Claude Code 環境專屬的操作慣例，不重複 AGENTS.md 已有內容。

---

## 0. Claude Code 工作慣例

- **對話語言**：繁體中文（zh-TW），程式碼識別字保留英文。
- **`gh` CLI 路徑**：本機 `gh` 安裝於 `/opt/homebrew/bin/gh`。當 PATH 解析有問題時請使用絕對路徑。
- **建置與測試**：
  - 開發版：`make`（產生 `arc-sidebar-vX.X.X-dev.zip`）
  - 發布版：`make release`
  - 清理：`make clean`
  - 測試：`npm test`（Jest + Puppeteer）
  - 需要 `jq` 才能自動讀取版本號
- **預覽方式**：`chrome://extensions` → 開發人員模式 → 載入未封裝的項目 → 選擇本專案根目錄。
- **Skill 自動觸發**：使用者提到下列關鍵字時，主動 invoke 對應的 `.claude/skills/<name>/SKILL.md`：
  - 「SDD / 新功能 / 修 bug」→ `sdd`
  - 「PRD / 產品需求」→ `prd`
  - 「SA / 系統分析」→ `sa`
  - 「review PR / 審查 / 程式碼審查」→ `code-review`
  - 「建 PR / pull request」→ `pull-request`
  - 「commit message / 提交訊息」→ `commit-message-helper`
  - 「refactor / 重構」→ `refactoring`
  - 「release note / 發版說明」→ `release-notes`
  - 「多語系 / i18n 文件」→ `update-multilingual-docs`
  - 「Puppeteer 測試 / E2E」→ `puppeteer-test`
  - 「圖片格式 / WebP / 圖示處理 / 自訂背景圖」→ `image-master`
  - 「清理分支 / cleanup branches」→ `cleanup-merged-branches`
  - 「配色 / 字型 / palette / design system」→ `ui-ux-pro-max`
  - 「審查 UI / 檢查無障礙 / accessibility / UI review」→ `web-design-guidelines`
  - 「建立新 skill / 寫 skill」→ `skill-creator`
- **Session 收尾**：沿用既有 Context Engineering 慣例 — 收斂變更摘要寫入 `.agent/notes/NOTE_YYYYMMDD.md`，作為未來開發脈絡參考。**`.agent/notes/` 已 gitignore（本地脈絡用，不入版控）**；正式設計文件請放 `docs/specs/`（SDD 產出）。

## 1. Commit / PR / Release Note 規範

- **Commit**：遵循 `.agent/skills/commit-message-helper/SKILL.md`（Conventional Commits；subject 英文、body 繁中說明背景／原因／實作細節）。
- **PR**：遵循 `.agent/skills/pull-request/SKILL.md` 與 `.agent/rules/RULE_006_PR_REVIEW_GUIDELINES.md`。
  - 使用 `gh` CLI 進行 review，語言用 zh-TW。
- **Release Note**：遵循 `.agent/skills/release-notes/SKILL.md`，沿用 `.github/release.yml` 的區塊結構（✨ 新功能、🚀 改善與錯誤修復）。產出的 `RELEASE_NOTE.md` 為暫存預覽，**不入版控**。

## 2. 與 GEMINI.md 的關係

- `GEMINI.md` 為 gemini-cli 專屬設定檔，**保留供雙工具並存**。
- `AGENTS.md` 為 cross-tool 真實來源；`CLAUDE.md` / `GEMINI.md` 各自寫工具專屬補充。
- **不雙寫同步、不設 drift CI**：三份檔案分別維護，AGENTS.md 結構大改時手動更新各副本。
- 若改動到 key file 用途或新增模組，**仍需同步更新 `GEMINI.md` 內的 `key_files` 描述**（這是 GEMINI.md 獨有的、AGENTS.md 沒有的資訊；屬於專案歷史約定）。

## 3. 開發紀律（沿用 .agent/rules/）

- **分級 SDD**：動工前先讀 `sdd` skill 做分級判定並向使用者提出 — T0 直接做（typo/文案/樣式微調）、T1 單檔 `SPEC.md` 與實作同步隨 PR 審（預設）、T2 完整 PRD → SA 先審後寫（storage schema／權限／跨 context 協定／大型功能）。判準以 `.agent/skills/sdd/SKILL.md` 為單一事實來源。
- **連動影響**：改動 `manifest.json` / `sidepanel.js` / `modules/ui/elements.js` 等核心檔案時，需同步檢視相依模組（參考 `AGENTS.md` Skill Index 與 `RULE_002_ARCHITECTURE.md`）。
- **`.claude/skills/` 來源**：實際指向 `../.agent/skills/`（軟連結）。更新 skill 內容請編輯 `.agent/skills/<name>/SKILL.md`，Claude Code 與 gemini-cli 會同步看到變更。
