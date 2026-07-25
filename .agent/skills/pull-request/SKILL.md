---
name: pull-request
description: 建立本專案的 Pull Request：雙語描述 (zh-TW/en)、gh CLI、.agent/skills/pull-request/scripts/check-pr.sh 預驗證、references/pr_template.md 與 checklist.md。當使用者提到「開 PR、建 PR、create PR、pull request、提交變更、發 PR、新建 PR」時觸發。
---

# Pull Request Skill

本專案建立 PR 的專屬慣例與工具。gh CLI 的一般用法不在此重複。

## 本專案慣例

1. **雙語描述**：PR 描述必須同時包含 zh-TW 與英文版本，格式見 `references/pr_template.md`。
2. **標題**：英文，遵循 Conventional Commits（squash merge 後會成為 main 上的 commit subject）。
3. **提交管道**：本機用 `gh` CLI；Claude Code on the web 等遠端環境沒有 `gh`，改用 GitHub MCP `create_pull_request`（預設開 draft）。判斷方式：`command -v gh`。
4. **PR 大小**：理想 < 400 行變更；> 800 行考慮拆分。
5. **互動式 git 指令**（如 `git rebase -i`）在非互動環境不支援；整理 commit 請在本機互動式 shell 執行。

## 流程

```bash
# 1. commit 並推送分支
git push -u origin <branch-name>

# 2. 預驗證（分支已推送、有 commit 差異、測試可選）
./.agent/skills/pull-request/scripts/check-pr.sh

# 3. 建立 PR（描述用模板檔組稿）
gh pr create --title "type(scope): description" --body-file <(cat 組好的描述)
```

## 提交前檢查清單

完整清單見 `references/checklist.md`，最低要求：

- [ ] 測試已通過（驗證組合見 `verification` skill）
- [ ] PR 描述包含雙語版本與 `## Summary` / `## Test plan`
- [ ] T1/T2 案件：SPEC.md / spec 文件已隨 PR 附上並與實作一致
