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
    -   **CI 穩定性 (CI Stability)**: 測試是否有 race condition 風險？參照下方「CI 測試穩定性方針」逐項檢查。

### CI 測試穩定性方針

以下方針源自 PR #72 / #73 的實際 CI 失敗修正經驗，Review 測試程式碼時**必須**逐項檢查。

#### 1. 禁止 `setTimeout` 固定等待

-   ⚠️ **禁止**在測試中使用 `setTimeout(resolve, N)` 作為等待手段。CI 環境資源受限，固定延遲無法保證操作完成。
-   ✅ 改用 `page.waitForFunction()` 條件式等待，明確等待 DOM 狀態改變：
    ```javascript
    // ❌ Bad
    await new Promise(r => setTimeout(r, 1000));
    
    // ✅ Good
    await page.waitForFunction(
        () => document.querySelectorAll('.bookmark-item').length > 0,
        { timeout: 10000 }
    );
    ```

#### 2. 頁面重用 vs 每次新建

-   ⚠️ 若多個測試不需要獨立頁面狀態，**禁止**每個 test 各自 `browser.newPage()` + `page.goto()`。CI 資源受限時，重複建立頁面會導致整體超時。
-   ✅ 在 `beforeAll` 中建立一個共用頁面，跨測試重用：
    ```javascript
    // ✅ Good: 共用頁面
    beforeAll(async () => {
        const setup = await setupBrowser();
        page = setup.page;
        await page.waitForSelector('#tab-list', { timeout: 15000 });
    });
    ```
-   若測試間需要隔離（如 modal 開關），在每個測試結束時**手動清理 UI 狀態**（關閉 modal、刪除臨時資料等），而非重建頁面。

#### 3. 事件委派就緒的競態條件

-   ⚠️ `page.reload()` 後立即 `page.click()` 可能失效——DOM 元素已渲染但事件委派尚未初始化。
-   ✅ 先等待容器元素（如 `#bookmark-list`）出現確保事件委派已掛載，並搭配**重試機制**：
    ```javascript
    // ✅ 先等待容器就緒
    await page.waitForSelector('#bookmark-list', { timeout: 10000 });
    // ✅ 點擊後等待狀態改變，失敗則重試
    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.click(selector);
        try {
            await page.waitForFunction(condition, { timeout: 5000 });
            break;
        } catch (e) {
            if (attempt === 3) throw e;
            await new Promise(r => setTimeout(r, 500));
        }
    }
    ```

#### 4. 延遲註冊的事件監聽器

-   ⚠️ 若應用程式碼中使用 `setTimeout(0)` 延遲註冊 listener（如 `contextMenuManager` 的 click 監聽），測試中直接 dispatch 事件可能因 listener 尚未註冊而無效。
-   ✅ 在 `page.evaluate` 中等待一個 tick 再觸發：
    ```javascript
    await page.evaluate(() => {
        return new Promise(resolve => {
            setTimeout(() => {
                document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                resolve();
            }, 50);
        });
    });
    ```

#### 5. 資源清理 (`afterEach`)

-   ⚠️ **禁止**僅在 test body 中清理資源（tab、bookmark），測試失敗時清理邏輯會被跳過。
-   ✅ 將清理邏輯放在 `afterEach` 或 `finally` 區塊，確保必定執行：
    ```javascript
    let createdTabId = null;
    afterEach(async () => {
        if (createdTabId) {
            await page.evaluate(id => chrome.tabs.remove(id), createdTabId);
            createdTabId = null;
        }
    });
    ```

#### 6. URL 比對

-   ⚠️ 避免使用嚴格相等 (`===`) 比對 URL，Chrome 可能會自動加上或移除尾斜線。
-   ✅ 使用 `startsWith` 或 `includes`：
    ```javascript
    // ❌ Bad
    el.dataset.url === 'https://example.com'
    
    // ✅ Good
    el.dataset.url.startsWith('https://example.com')
    ```

#### 7. Null 安全防禦

-   ⚠️ `document.activeElement` 等動態屬性在 CI 中可能為 `null`。
-   ✅ 使用 optional chaining (`?.`) 和 nullish coalescing (`?? null`)：
    ```javascript
    document.activeElement?.dataset?.tabId ?? null
    ```

#### 8. UI 操作 vs Chrome API 驗證

-   ⚠️ 拖曳、滑鼠模擬等 UI 操作在 Headless 環境不穩定（特別是依賴 SortableJS 等函式庫）。
-   ✅ 若情境允許，改用 Chrome API 直接驗證業務邏輯：
    ```javascript
    // ❌ Bad: 模擬 UI 拖曳
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2);
    await page.mouse.up();
    
    // ✅ Good: 使用 API 驗證排序邏輯
    await page.evaluate(id => chrome.bookmarks.move(id, { index: 0 }), bookmarkId);
    const children = await page.evaluate(parentId =>
        new Promise(r => chrome.bookmarks.getChildren(parentId, r)), parentId
    );
    expect(children[0].id).toBe(bookmarkId);
    ```

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
