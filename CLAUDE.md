# Claude Code Project Guide — arc-like-chrome-extension

> **主要文件指向**：請先讀 `AGENTS.md`（含 Quick Start、Skill / Workflow / Rules 索引）
> 與 `.agent/rules/RULE_002_ARCHITECTURE.md`、`.agent/rules/RULE_006_PR_REVIEW_GUIDELINES.md`。
> 本檔僅補充 Claude Code 環境專屬的操作慣例，不重複 AGENTS.md 已有內容。

---

## 0. Claude Code 工作慣例

- **對話語言**：繁體中文（zh-TW），程式碼識別字保留英文。
- **建置與測試**：
  - 開發版：`make`（產生 `arc-sidebar-vX.X.X-dev.zip`）
  - 發布版：`make release`
  - 清理：`make clean`
  - 測試：`npm test`（E2E 全套）/ `npm run test:ci`（happy-path 快驗）/ `npm run test:unit`
  - 需要 `jq` 才能自動讀取版本號
- **預覽方式**：`chrome://extensions` → 開發人員模式 → 載入未封裝的項目 → 選擇本專案根目錄。
- **動工前後的紀律**（對任何模型等級都適用，越小的模型越要照走）：
  1. 動工前：依 `sdd` skill 分級（T0/T1/T2）並向使用者提出。
  2. 修 bug：先讀 `debugging` skill——先重現、證據優先、一次一個變因。
  3. 收尾前：依 `verification` skill 的火力表跑最小充分驗證，誠實回報結果。

## 0.1 執行環境差異（本機 vs Claude Code on the web）

同一份 repo 會在兩種環境被 Claude 操作，指令選擇不同：

| 事項 | 本機（macOS） | Claude Code on the web / 遠端容器 |
|---|---|---|
| GitHub 操作（PR/issue/review） | `gh` CLI（安裝於 `/opt/homebrew/bin/gh`，PATH 有問題時用絕對路徑） | **沒有 `gh`**；改用 GitHub MCP 工具（`mcp__github__*`） |
| git push | 直接 push | 經授權 proxy push；只授權本 repo，**無法 push 其他 repo（含 `.wiki.git`）** |
| PR 建立 | `gh pr create`（見 `pull-request` skill） | GitHub MCP `create_pull_request`，預設開 **draft** |
| Wiki 更新 | 改 `docs/wiki/*.md` 走 PR（勿直接編 GitHub Wiki） | 同左；merge 到 main 後由 Action 自動同步 |

判斷方式：檢查 `command -v gh`；不存在即視為遠端環境。

## 0.2 Skill 自動觸發

使用者提到下列關鍵字時，主動 invoke 對應的 `.claude/skills/<name>/SKILL.md`：

| 關鍵字 | Skill |
|---|---|
| 「SDD / 新功能 / 修 bug / 要做一個 X」 | `sdd`（先分級） |
| 「除錯 / debug / 壞掉 / 查原因 / flaky」 | `debugging` |
| 「驗證 / 收尾 / 完成了嗎 / 送 PR 前」 | `verification` |
| 「PRD / 產品需求」 | `prd` |
| 「SA / 系統分析」 | `sa` |
| 「review PR / 審查 / 程式碼審查」 | `code-review` |
| 「建 PR / pull request」 | `pull-request` |
| 「commit message / 提交訊息」 | `commit-message-helper` |
| 「refactor / 重構」 | `refactoring` |
| 「release note / 發版說明」 | `release-notes` |
| 「多語系 / i18n 文件」 | `update-multilingual-docs` |
| 「Puppeteer 測試 / E2E」 | `puppeteer-test` |
| 「圖片格式 / WebP / 圖示處理 / 自訂背景圖」 | `image-master` |
| 「清理分支 / cleanup branches」 | `cleanup-merged-branches` |
| 「審查 UI / 檢查無障礙 / accessibility / 配色 / UI review」 | `web-design-guidelines` |
| 「更新 harness / 文件過時 / drift / 維護 wiki」 | `harness-maintenance` |
| 「建立新 skill / 寫 skill」 | `skill-creator` |

- **Session 收尾**：沿用既有 Context Engineering 慣例 — 收斂變更摘要寫入 `.agent/notes/NOTE_YYYYMMDD.md`，作為未來開發脈絡參考。**`.agent/notes/` 已 gitignore（本地脈絡用，不入版控）**；正式設計文件請放 `docs/specs/`（SDD 產出）。若本次變更動到 harness 提及的檔案，順手依 `harness-maintenance` skill 檢查對應文件。

## 1. Commit / PR / Release Note 規範

- **Commit**：遵循 `.agent/skills/commit-message-helper/SKILL.md`（Conventional Commits；subject 英文、body 繁中說明背景／原因／實作細節）。
- **PR**：遵循 `.agent/skills/pull-request/SKILL.md` 與 `.agent/rules/RULE_006_PR_REVIEW_GUIDELINES.md`。
  - Review 語言用 zh-TW；提交管道依 §0.1 選 `gh` 或 GitHub MCP。
- **Release Note**：遵循 `.agent/skills/release-notes/SKILL.md`，沿用 `.github/release.yml` 的區塊結構（✨ 新功能、🚀 改善與錯誤修復）。產出的 `RELEASE_NOTE.md` 為暫存預覽，**不入版控**。

## 2. 與 GEMINI.md 的關係

- `GEMINI.md` 為 gemini-cli 專屬設定檔，**保留供雙工具並存**。
- `AGENTS.md` 為 cross-tool 真實來源；`CLAUDE.md` / `GEMINI.md` 各自寫工具專屬補充。
- **不雙寫同步、不設 drift CI**：三份檔案分別維護，AGENTS.md 結構大改時手動更新各副本。
- 若改動到 key file 用途或新增模組，**仍需同步更新 `GEMINI.md` 內的 `key_files` 描述**——`key_files` 是檔案級模組職責的**單一事實來源**（AGENTS.md 只保留目錄級地圖並指向它；屬於專案歷史約定）。

## 3. 開發紀律（沿用 .agent/rules/）

- **分級 SDD**：動工前先讀 `sdd` skill 做分級判定並向使用者提出 — T0 直接做（typo/文案/樣式微調）、T1 單檔 `SPEC.md` 與實作同步隨 PR 審（預設）、T2 完整 PRD → SA 先審後寫（storage schema／權限／跨 context 協定／大型功能）。判準以 `.agent/skills/sdd/SKILL.md` 為單一事實來源。
- **連動影響**：改動 `manifest.json` / `sidepanel.js` / `modules/ui/elements.js` 等核心檔案時，需同步檢視相依模組（參考 `AGENTS.md` Architecture Navigator 與 `RULE_002_ARCHITECTURE.md`）；新增/改名檔案務必檢查 `Makefile` 打包清單。
- **`.claude/skills/` 來源**：實際指向 `../.agent/skills/`（軟連結）。更新 skill 內容請編輯 `.agent/skills/<name>/SKILL.md`，Claude Code 與 gemini-cli 會同步看到變更。
