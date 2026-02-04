---
description: How to review a Pull Request using gh CLI
---

This workflow guides the agent through the process of reviewing a GitHub Pull Request.

## 1. Fetch PR Information

// turbo
```bash
gh pr view <PR_NUMBER> --json title,body,state,author,files,additions,deletions,headRefName,baseRefName
```

// turbo
```bash
gh pr diff <PR_NUMBER>
```

## 2. Analyze the PR

-   Run lint check on modified files:
    // turbo
    ```bash
    .agent/skills/code-review/scripts/lint-check.sh <MODIFIED_FILE_PATH>
    ```
-   Check against rules: `RULE_005_DEVELOPMENT_GUIDELINES.md` (DRY, I18n, etc.) and `RULE_006_PR_REVIEW_GUIDELINES.md`.
-   Review Checklist:
    -   **正確性 (Correctness)**: 程式碼是否符合預期功能？
    -   **邊界情況 (Edge cases)**: 是否處理了錯誤條件？以及思考是否存在其他未被考慮到的情況。
    -   **Side Effects**: 是否存在潛在的副作用？
    -   **風格 (Style)**: 是否符合專案規範？
    -   **效能 (Performance)**: 是否存在明顯的效率低落？
    -   **CI 穩定性 (CI Stability)**: 測試是否有 race condition 風險？
        -   ⚠️ 避免使用 `setTimeout` 進行固定時間等待
        -   ✅ 優先使用 `page.waitForFunction()` 條件式等待
        -   ✅ 等待 DOM 元素出現或狀態改變，而非假設延遲時間

## 3. Generate Review Comment

-   Draft the comment in Traditional Chinese (zh-TW).
-   Ensure it includes specific suggestions and code blocks where applicable.
-   Use tables to organize issues by priority (🔴 高 / 🟡 中 / 🟢 低).
-   **CRITICAL**: Append the signature `created by antigravity agent` at the end.

## 4. Submit Review

-   Save the comment to a temporary file:
    ```bash
    # Write review to pr_comment.md
    ```
-   Run the command:
    ```bash
    gh pr review <PR_NUMBER> --comment --body-file pr_comment.md
    ```
-   Remove the temporary file:
    // turbo
    ```bash
    rm pr_comment.md
    ```

## 5. Check PR Author and Auto-Fix (Conditional)

**If the PR author is `Tai-ch0802` (or a bot acting on behalf of the owner):**

Instead of just leaving a comment, directly take over the branch and implement the fixes:

1.  **Checkout the PR branch**:
    ```bash
    git stash && git checkout <PR_BRANCH_NAME>
    ```

2.  **Implement the suggested fixes** based on the review comments.

3.  **Run tests to verify**:
    // turbo
    ```bash
    npm test
    ```

4.  **Commit and push the fixes**:
    ```bash
    git add <MODIFIED_FILES>
    git commit -m "fix(<scope>): <description of fixes>
    
    <Detailed body in zh-TW explaining the changes>"
    git push origin <PR_BRANCH_NAME>
    ```

5.  **Return to main branch**:
    // turbo
    ```bash
    git checkout main
    ```

## 6. Notify User

-   Inform the user that the review has been submitted.
-   If fixes were applied, provide a summary of the changes made.
-   If no fixes were applied (PR author is not the owner), provide the summary of the feedback.
