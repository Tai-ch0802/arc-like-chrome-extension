---
description: How to review a Pull Request using gh CLI
---

This workflow guides the agent through the process of reviewing a GitHub Pull Request.

1.  **Analyze the PR**
    -   Fetch the diff: `read_url_content(Url="https://github.com/Tai-ch0802/arc-like-chrome-extension/pull/<PR_NUMBER>.diff")`
    -   Check against rules: `RULE_005_DEVELOPMENT_GUIDELINES.md` (DRY, I18n, etc.) and `RULE_006_PR_REVIEW_GUIDELINES.md`.

2.  **Generate Review Comment**
    -   Draft the comment in Traditional Chinese (zh-TW).
    -   Ensure it includes specific suggestions and code blocks where applicable.
    -   **CRITICAL**: Append the signature `created by antigravity agent` at the end.

3.  **Submit Review**
    -   Save the comment to a temporary file (e.g., `pr_comment.md`).
    -   Run the command:
        ```bash
        gh pr review <PR_NUMBER> --comment --body-file pr_comment.md
        ```
    -   Remove the temporary file: `rm pr_comment.md`

4.  **Notify User**
    -   Inform the user that the review has been submitted and provide a summary of the feedback.
