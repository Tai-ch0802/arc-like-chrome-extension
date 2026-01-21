---
description: How to create a Pull Request using the gh CLI with validation
---

# Create Pull Request Workflow

此 workflow 指導如何使用 `gh` CLI 建立高品質的 Pull Request。

## 前置條件

- 已安裝 GitHub CLI (`gh`)
- 已登入 GitHub (`gh auth login`)
- 變更已 commit 到 feature branch

---

## 步驟 1: 確認變更狀態

```bash
git status
git log --oneline -5
```

確認：
- 沒有未 commit 的變更
- 正確的 commit 數量

---

## 步驟 2: 推送分支到遠端

```bash
git push -u origin $(git branch --show-current)
```

---

## 步驟 3: 執行 PR 驗證腳本

// turbo
```bash
./.agent/skills/pull-request/scripts/check-pr.sh
```

檢查項目包括：
- Git 狀態 (是否在 feature branch、是否已推送)
- Commit message 格式
- 程式碼品質 (console.log、TODO)
- PR template 存在性

若要同時執行測試，加上 `--run-tests` 參數：

```bash
./.agent/skills/pull-request/scripts/check-pr.sh --run-tests
```

---

## 步驟 4: 建立 Pull Request

### 方法 A: 互動模式 (推薦新手)

```bash
gh pr create
```

系統會依序詢問：
1. 標題
2. 描述 (會自動載入 PR template)
3. 是否為 Draft
4. 其他選項

### 方法 B: 指定標題與 Body (推薦自動化)

```bash
gh pr create \
  --title "feat(scope): 功能描述" \
  --body-file .github/pull_request_template.md
```

### 方法 C: 在瀏覽器中建立

```bash
gh pr create --web
```

---

## 步驟 5: 指定 Reviewer 與 Labels

在建立時指定：

```bash
gh pr create \
  --title "fix(ui): 修復問題" \
  --reviewer user1,user2 \
  --label "bug,priority:high"
```

或建立後新增：

```bash
# 取得剛建立的 PR number
PR_NUM=$(gh pr view --json number -q .number)

# 新增 reviewer
gh pr edit $PR_NUM --add-reviewer user1

# 新增 label
gh pr edit $PR_NUM --add-label "enhancement"
```

---

## 步驟 6: 驗證 PR 建立成功

```bash
# 查看 PR
gh pr view

# 在瀏覽器中開啟
gh pr view --web
```

---

## 常見問題

### Q: 忘記填寫英文版描述？

建立後可編輯：

```bash
gh pr edit --body "updated description"
```

### Q: 需要轉為 Draft PR？

```bash
gh pr ready --undo
```

### Q: 需要變更目標分支？

```bash
gh pr edit --base develop
```

---

## 完整範例

```bash
# 1. 確認狀態
git status

# 2. 推送分支
git push -u origin feature/my-feature

# 3. 驗證
./.agent/skills/pull-request/scripts/check-pr.sh

# 4. 建立 PR
gh pr create \
  --title "feat(ui): add new button component" \
  --body "## Summary
This PR adds a new reusable button component.

## Changes
- Added Button component
- Added tests

## English Version
This PR introduces a new Button UI component with full test coverage." \
  --reviewer teammate \
  --label "enhancement"

# 5. 查看結果
gh pr view --web
```
