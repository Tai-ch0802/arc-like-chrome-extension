# Contributing to Arc-Like Chrome Extension

🎉 First off, thanks for taking the time to contribute!

我們致力於打造一個 **低門檻**、**AI 友善** 的開源社群。我們非常鼓勵使用 AI 工具（特別是 **Antigravity IDE**）來輔助開發。即使你是程式新手，或者不熟悉這個領域，只要你有想法，我們都歡迎你透過我們的標準化流程貢獻程式碼。

這份文件將引導你如何將一個「模糊的願望」轉化為「可用的功能」。

## 🚀 核心理念 (Core Philosophy)

1.  **AI-Native Development**: 我們擁抱 AI。不要害怕讓 AI 幫你寫 Code、寫文件或解釋架構。
2.  **Spec-Driven Development (SDD)**: 想清楚再動手。先有規格文件 (Spec)，才有程式碼 (Code)。
3.  **Low Friction**: 透過自動化工具與明確的 SOP，降低參與貢獻的難度。

## 🛠 推薦工具 (Tools)

*   **IDE**: 強烈推薦使用 **Antigravity IDE** AI 增強型編輯器。
*   **Version Control**: Git & GitHub CLI (`gh`).
*   **Runtime**: Node.js & npm.

## 🛤 開發者 SOP: 從想法到實現

我們採用一套標準化的 **Spec-Driven Development (SDD)** 流程，協助你一步步完成開發。

### Phase 1: 提出想法 (Idea & Issue)

一切都始於一個想法。

1.  **檢查現有 Issue**: 看看是否有人提過類似的想法。
2.  **建立 Issue**:
    *   如果是新功能，使用 **Feature Request** 模板。
    *   如果是修復錯誤，使用 **Bug Report** 模板。
    *   *Tip: 即使想法很模糊也沒關係，先開 Issue 討論。*

### Phase 2: 系統分析 (Analysis & Spec)

當 Issue 被確認後，我們進入 SDD 流程。這是了解 Domain Knowledge 最好的時刻。

1.  **啟動 SDD Workflow**:
    在專案根目錄，你可以要求 AI Agent：
    > "我要開始開發 Issue #123，請幫我執行 /sdd-process"
    *   AI 會建立標準目錄：`/docs/specs/{type}/ISSUE-123_{desc}/`。

2.  **撰寫 PRD (Product Requirement Document)**:
    *   AI 會協助你建立 `/docs/specs/.../PRD_spec.md`。
    *   你需要定義：**做什麼 (User Stories)** 和 **驗收標準 (Acceptance Criteria)**。
    *   *Tip: 善用 AI 來幫你完善 User Story 和邊界情況。*

3.  **撰寫 SA (System Analysis)**:
    *   PRD 核准後，AI 協助建立 `/docs/specs/.../SA_spec.md`。
    *   你需要定義：**技術架構**、**API**、**資料流**。
    *   **Traceability**: 確保每個設計都對應到 PRD 需求。

### Phase 3: 實作 (Implementation)

規格確定後，就是快樂的 Coding 時間。

1.  **Pre-Code Check**:
    *   確認 PRD 與 SA 狀態皆為 **Approved**。

2.  **讓 AI 寫 Code**:
    *   將 `PRD_spec.md` 和 `SA_spec.md` 餵給 Antigravity/AI。
    *   指令範例：*"請依照 SA_spec.md 的 Task 1 實作其他視窗渲染功能。"*

3.  **Living Documentation (活體文件)**:
    *   ⚠️ **重要**：如果在實作中發現需要修改設計，**請立即更新 SA/PRD**。
    *   保持 Spec 與 Code 永遠同步。

### Phase 4: 驗證與提交 (Verification & PR)

1.  **自我審查**:
    *   執行 `npm test` 確保測試通過。
    *   使用 AI 進行初步 Code Review (可使用我們提供的 Skill)。

2.  **發起 Pull Request**:
    *   使用 `gh` CLI 建立 PR (推薦) 或透過網頁介面。
    *   若您使用的是 Antigravity，可直接使用 `/create-pr` 這 workflow。
    *   執行驗證指令：
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   確保 PR 描述完整且包含雙語對照 (AI 可以幫你翻譯)。

## 📝 樣式指南 (Style Guides)

*   **Commit Messages**: 遵循 Conventional Commits (`feat`, `fix`, `docs`, `refactor`...)。
    *   可以採用本專案裡頭的 `commit-message-helper`  SKILL。
*   **Language**: 專案文件與溝通可採用您的原生語言，但程式碼註解與變數應使用英文。
*   **Code Style**: 保持一致性，參考現有程式碼風格。

## 🤝 尋求協助

*   如果你在過程中卡住了，請在 Issue 中留言。
*   善用 AI 詢問："解釋這段程式碼是什麼意思？" 或 "我該如何測試這個功能？"。

期待你的貢獻！讓我們一起用 AI 打造更棒的軟體。
