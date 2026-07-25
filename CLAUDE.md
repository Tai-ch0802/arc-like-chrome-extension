# CLAUDE.md — arc-like-chrome-extension

> 先讀 `AGENTS.md`（Quick Start、專案概觀、skills / rules 索引）與 `.agent/rules/RULE_002_ARCHITECTURE.md`（架構不變式）。
> 本檔依 Claude 5 世代 context engineering 原則刻意精簡：只放 Claude Code 專屬慣例與無法從程式碼推斷的 gotcha，細節走 progressive disclosure 到對應 skill / workflow，其餘信任模型判斷與 skill 的 description 觸發機制。

## 工作慣例

- 對話與文件用繁體中文（zh-TW）；commit subject 與 PR 標題英文（Conventional Commits）、body 與 PR review 繁中，寫背景與根因（完整語言表見 `AGENTS.md`）。
- 動工前依 `sdd` skill 分級（T0/T1/T2）並向使用者提出；修 bug 先讀 `debugging` skill；收尾前依 `verification` skill 跑最小充分驗證並誠實回報。
- Session 收尾：變更摘要寫 `.agent/notes/NOTE_YYYYMMDD.md`（已 gitignore，本地脈絡用）；正式設計文件放 `docs/specs/`。動到 harness 提及的檔案時，依 `harness-maintenance` skill 順手檢查對應文件。

## 本 repo gotchas（無法從程式碼推斷的部分）

- 新增/改名檔案必須同步 `Makefile` 打包清單（`DEV_SRC_FILES` / prod esbuild 清單），否則 release zip 漏包——歷史事故。
- PR 採 squash merge：`git branch --merged` 永遠偵測不到已合併分支；清理分支以 `gh pr list --state merged` 為準後用 `-D`（流程見 `.agent/workflows/cleanup-branches.md`）。
- `.claude/skills` 與 `.gemini/skills` 都是指向 `.agent/skills/` 的 symlink：skill 內容改 `.agent/skills/<name>/SKILL.md` 一處，Claude Code 與 gemini-cli 同步生效。
- `GEMINI.md` 的 `key_files` 是檔案級模組職責的單一事實來源（專案歷史約定）：新增模組或改變模組職責時同步更新它；`AGENTS.md` 只放目錄級地圖。三份設定檔（AGENTS / CLAUDE / GEMINI）分別維護、不雙寫同步、不設 drift CI。
- Release note：雙語（zh-TW 前、en 後）+ contributors 段，區塊沿用 `.github/release.yml`；產出的 `RELEASE_NOTE.md` 為暫存預覽、不入版控。流程與模板見 `.agent/workflows/create-release-note.md`。
- Wiki 的原始檔在 `docs/wiki/`，merge 到 main 後由 Action 自動同步至 GitHub Wiki；勿直接在 Wiki UI 編輯（會被覆蓋）。

## 執行環境差異（本機 vs Claude Code on the web）

同一份 repo 會在兩種環境被 Claude 操作，指令選擇不同：

| 事項 | 本機（macOS） | Claude Code on the web / 遠端容器 |
|---|---|---|
| GitHub 操作（PR/issue/review） | `gh` CLI（安裝於 `/opt/homebrew/bin/gh`，PATH 有問題時用絕對路徑） | **沒有 `gh`**；改用 GitHub MCP 工具（`mcp__github__*`） |
| git push | 直接 push | 經授權 proxy push；只授權本 repo，**無法 push 其他 repo（含 `.wiki.git`）** |
| PR 建立 | `gh pr create`（見 `pull-request` skill） | GitHub MCP `create_pull_request`，預設開 **draft** |

判斷方式：檢查 `command -v gh`；不存在即視為遠端環境。
