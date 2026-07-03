---
name: harness-maintenance
description: 維護本專案 AI agent harness（AGENTS.md / CLAUDE.md / GEMINI.md / .agent/{rules,skills,workflows} / docs/wiki）的 SOP：單一事實來源對照表、drift 稽核步驟、新增/刪除 skill 的判準、wiki 同步機制。當使用者提到「更新 harness、同步 AGENTS、文件過時、drift、稽核設定檔、整理 skills、維護 wiki」時觸發。
---

# Harness Maintenance Skill — 制度的自我維護

Harness（agent 設定檔與知識庫）不維護就會腐爛：檔案改名了文件還指舊名、流程改了三份副本只改一份。**過時的指示比沒有指示更危險**——agent 會自信地照著錯的做。本 skill 定義稽核與維護 SOP。

## 檔案地圖與單一事實來源（SSOT）

| 主題 | 單一事實來源 | 其他副本（只放摘要+指標） |
|---|---|---|
| 檔案級模組職責 | `GEMINI.md` `key_files` | `AGENTS.md`（目錄級）、`RULE_002`（不變式） |
| SDD 流程細節 | `.agent/skills/sdd/SKILL.md` | `RULE_007`、`.agent/workflows/sdd-process.md`、`AGENTS.md` |
| E2E 測試模式 | `.agent/skills/puppeteer-test/SKILL.md` | `.agent/workflows/puppeteer-test.md` |
| CI 測試穩定性 8 條方針 | `.agent/workflows/review-pr.md` | `code-review` skill（節錄） |
| Commit / PR / Release 規範 | 各對應 skill | `RULE_004`、`CLAUDE.md` §1 |
| 建置指令 | `Makefile`（程式即文件） | `RULE_003`、`AGENTS.md` Quick Start |
| 人類導向專案文件 | `docs/wiki/`（經 Action 同步至 GitHub Wiki） | — |

**同步規則**：改 SSOT 時，順手檢查右欄副本的摘要是否還成立；副本永遠不寫 SSOT 沒有的細節。
`.claude/skills` 與 `.gemini/skills` 都是指向 `.agent/skills` 的 symlink——skill 只需改一處。

## Drift 稽核 SOP（大型重構後、或發現一處過時時執行）

1. **檔案引用存在性**：把 harness 文件中提到的路徑逐一驗證。
   ```bash
   # 抽出 .md 中的 modules/ 路徑並檢查存在
   grep -rhoE '(modules|usecase_tests|scripts|docs)/[A-Za-z0-9_/.-]+\.(js|mjs|md|sh)' \
     AGENTS.md CLAUDE.md GEMINI.md .agent/rules .agent/skills --include='*.md' \
     | sort -u | while read f; do [ -e "$f" ] || echo "MISSING: $f"; done
   ```
2. **指令正確性**：文件中的 `npm run *` 是否存在於 `package.json` scripts？`make` target 是否存在於 `Makefile`？
3. **skill description 誠實性**：每個 SKILL.md 的 description 宣稱的檔案/腳本是否存在、觸發關鍵字清單是否與 `CLAUDE.md` §0 對齊。
4. **副本一致性**：對照上方 SSOT 表，抽查各副本摘要與 SSOT 是否矛盾。
5. **修正原則**：發現 drift 時**優先刪重複、改指標**，而不是把同一份細節再抄一遍。

## 新增 / 刪除 skill 的判準

**值得新增**的 skill 具備：
- 內容是**專案特定**的（本 repo 的檔案、指令、歷史事故、慣例），模型自身知識給不出來；
- 或是**判斷紀律**（步驟順序、檢查清單），弱模型照走就能達到強模型的決策品質。

**應該刪除**的 skill 特徵（判例：2026-07 刪除 `ui-ux-pro-max`，560KB 通用 CSV 資料庫、13 種與本專案無關的 tech stack、需 Python 執行環境）：
- 通用知識傾印（模型本來就會），且與專案技術棧大面積無關；
- 依賴專案不保證存在的執行環境；
- description 宣稱的能力與內容不符。

新 skill 一律放 `.agent/skills/<name>/`（symlink 自動讓 Claude/Gemini 同步看到），並同步：
1. `AGENTS.md` Skills 表格加一列；2. `CLAUDE.md` §0 觸發關鍵字表加一行；3. 用 `python3 .agent/skills/skill-creator/scripts/quick_validate.py` 驗證結構。刪除 skill 時反向清理同三處。

## GitHub Wiki 維護

- Wiki 內容的 SSOT 是 repo 內 `docs/wiki/`（wiki-as-code）；push 到 main 時由 `.github/workflows/wiki-sync.yml` 自動同步到 GitHub Wiki。
- **不要**直接在 GitHub Wiki UI 編輯（會被下次同步覆蓋）；改 `docs/wiki/*.md` 走 PR。
- Wiki 是人類也會讀的文件：內容必須與 repo 現況核實過才能寫，寧缺勿錯。

## 定期節律

- **每次 session 收尾**：本次變更若動到 harness 提及的檔案 → 順手更新對應文件（`CLAUDE.md` §0 的 session 收尾慣例）。
- **release 前**：跑一次上方 Drift 稽核 SOP 的步驟 1–2（成本低）。
- **大型重構（T2）後**：完整跑 SOP 1–5，並更新 `docs/wiki/Architecture.md`。
