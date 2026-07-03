# AI Agent Harness — 本專案的 AI 協作制度

本專案由人類 + 多套 AI agent（Claude Code、gemini-cli、Jules、GitHub Copilot）共同維護。本頁說明這套制度怎麼運作，給人類理解全貌，也給新接手的 agent 當導覽。

## 設定檔總覽

| 檔案 / 目錄 | 給誰讀 | 內容 |
|---|---|---|
| `AGENTS.md` | 所有 agent（cross-tool 真實來源） | Quick Start、Skills/Workflows/Rules 索引、SDD 摘要、目錄級架構地圖、語言慣例 |
| `CLAUDE.md` | Claude Code | Claude 專屬慣例：skill 觸發關鍵字、本機 vs 遠端環境差異（gh CLI vs GitHub MCP） |
| `GEMINI.md` | gemini-cli | Gemini 專屬設定；其中 **`key_files` 區塊是「檔案級模組職責」的單一事實來源**（歷史約定，所有工具共同維護） |
| `.github/copilot-instructions.md` | GitHub Copilot code review | 審查重點、SDD 分級對照 |
| `.agent/rules/` | 所有 agent | 7 條最高遵循方針（架構不變式、commit/release、開發準則、PR review、SDD） |
| `.agent/skills/` | 所有 agent | 技能庫（見下）；`.claude/skills` 與 `.gemini/skills` 是指向此處的 symlink |
| `.agent/workflows/` | 所有 agent | 標準化操作步驟（slash-command 式入口，細節指回對應 skill） |
| `.agent/notes/` | 本地 agent | session 收尾摘要（**gitignored**，僅本地脈絡） |
| `.jules/` | Jules 排程 agents | Prompt 範本（`README.md`）與各 agent 工作日誌 |
| `docs/wiki/` | 人類 + agent | 本 Wiki 的原始檔（wiki-as-code，經 Action 同步） |

## Skills（技能庫）

Skills 是可重用的操作知識，agent 依觸發關鍵字自動載入。分兩類：

**流程類**（判斷紀律，讓任何等級的模型照走都有一致品質）：
`sdd`（動工前分級）、`debugging`（除錯紀律 + 高頻根因表）、`verification`（交付前驗證火力表）、`code-review`、`pull-request`、`commit-message-helper`、`release-notes`、`cleanup-merged-branches`、`harness-maintenance`（本制度的自我維護 SOP）

**領域知識類**（專案特定 know-how）：
`prd` / `sa`（T2 spec 撰寫）、`puppeteer-test`（E2E 模式）、`refactoring`、`update-multilingual-docs`（14 語同步）、`image-master`（WebP/WCAG）、`web-design-guidelines`（sidepanel UI 審查）、`skill-creator`（meta）

### 單一事實來源（SSOT）原則

同一主題只在一處寫細節，其他地方放摘要 + 指標，避免多副本 drift：

| 主題 | SSOT |
|---|---|
| 檔案級模組職責 | `GEMINI.md` `key_files` |
| SDD 流程細節 | `.agent/skills/sdd/SKILL.md` |
| E2E 測試模式 | `.agent/skills/puppeteer-test/SKILL.md` |
| CI 測試穩定性方針 | `.agent/workflows/review-pr.md` |
| 建置指令 | `Makefile` 本身 |

發現文件與現況不符時，依 `.agent/skills/harness-maintenance/SKILL.md` 的 drift 稽核 SOP 處理。

## 排程 Agents（Jules）

| Agent | 頻率 | 職責 |
|---|---|---|
| Palette 🎨 | 每日 | UX 微改進（a11y、互動回饋） |
| Sentinel 🔒 | 每週一 | 安全巡檢（npm audit、XSS 反模式、CSP） |
| Bolt ⚡ | 每週三 | 效能巡檢（DOM thrashing、reconcile 模式） |
| Updater 📦 | 每月 | 依賴更新 |
| Tester 🧪 | 每日 | E2E 覆蓋補強（GitHub Actions 驅動） |

在 GitHub Issue 加 `jules` 標籤可手動啟動 Jules 任務。

## 人類如何與這套制度互動

- **想改流程**：改對應的 SSOT 檔案（rules / skills），發 PR。agent 下個 session 就會遵循新版。
- **想改這個 Wiki**：改 `docs/wiki/*.md` 發 PR，merge 後自動同步；**不要**直接在 Wiki UI 編輯。
- **review AI 的 PR**：AI 產出的 PR 一樣走 SDD 分級與人工 review；T2 案件 spec 未核准前不應有實作 commit。
- **AI review 簽名**：agent 留言結尾會標 `created by <tool-name> agent`，方便追溯是哪套工具的意見。
