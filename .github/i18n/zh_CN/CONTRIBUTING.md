# 贡献指南

🎉 首先，感谢你花时间参与贡献！

我们致力于打造一个 **低门槛**、**AI 友好** 的开源社区。我们非常鼓励使用 AI 工具（特别是 **Antigravity IDE**）来辅助开发。即使你是编程新手，或者不熟悉这个领域，只要你有想法，我们都欢迎你通过我们的标准化流程贡献代码。

这份文件将引导你如何将一个“模糊的愿望”转化为“可用的功能”。

## 🚀 核心理念

1.  **AI-Native Development**: 我们拥抱 AI。不要害怕让 AI 帮你写 Code、写文档或解释架构。
2.  **Spec-Driven Development (SDD)**: 想清楚再动手。先有规格文件 (Spec)，才有代码 (Code)。(`No Spec, No Code`)
3.  **Low Friction**: 通过自动化工具与明确的 SOP，降低参与贡献的难度。

## 🛠 工具

*   **IDE**: 强烈推荐使用 **Antigravity IDE** (AI 增强型编辑器)。
*   **Version Control**: Git & GitHub CLI (`gh`)。
*   **Runtime**: Node.js & npm。

## 🛤 开发者 SOP：从想法到实现

我们采用一套标准化的 **Spec-Driven Development (SDD)** 流程，协助你一步步完成开发。

### Phase 1: 提出想法 (Idea & Issue)

一切都始于一个想法。

1.  **检查现有 Issue**: 看看是否有人提过类似的想法。
2.  **建立 Issue**:
    *   如果是新功能，使用 **Feature Request** 模板。
    *   如果是修复错误，使用 **Bug Report** 模板。
    *   *Tip: 即使想法很模糊也没关系，先开 Issue 讨论。*

### Phase 2: 系统分析 (Analysis & Spec)

当 Issue 被确认后，我们进入 SDD 流程。这是了解 Domain Knowledge 最好的时刻。

1.  **启动 SDD Workflow**:
    在项目根目录，你可以要求 AI Agent：
    > "我要开始开发 Issue #123，请帮我执行 /sdd-process"
    *   AI 会建立标准目录：`/docs/specs/{type}/ISSUE-123_{desc}/`。

2.  **撰写 PRD (Product Requirement Document)**:
    *   AI 会协助你建立 `/docs/specs/.../PRD_spec.md`。
    *   你需要定义：**做什么 (User Stories)** 和 **验收标准 (Acceptance Criteria)**。
    *   *Tip: 善用 AI 来帮你完善 User Story 和边界情况。*

3.  **撰写 SA (System Analysis)**:
    *   PRD 核准后，AI 协助建立 `/docs/specs/.../SA_spec.md`。
    *   你需要定义：**技术架构**、**API**、**数据流**。
    *   **Traceability**: 确保每个设计都对应到 PRD 需求。

### Phase 3: 实作 (Implementation)

规格确定后，就是快乐的 Coding 时间。

1.  **Pre-Code Check**:
    *   确认 PRD 与 SA 状态皆为 **Approved**。

2.  **让 AI 写 Code**:
    *   将 `PRD_spec.md` 和 `SA_spec.md` 喂给 Antigravity/AI。
    *   指令范例：*"请依照 SA_spec.md 的 Task 1 实作其他窗口渲染功能。"*

3.  **Living Documentation (活体文档)**:
    *   ⚠️ **重要**：如果在实作中发现需要修改设计，**请立即更新 SA/PRD**。
    *   保持 Spec 与 Code 永远同步。

### Phase 4: 验证与提交 (Verification & PR)

1.  **自我审查**:
    *   执行 `npm test` 确保测试通过。
    *   **检查验收标准**：逐一检查 `PRD_spec.md` 中的 Acceptance Criteria。

2.  **发起 Pull Request**:
    *   使用 `gh` CLI 建立 PR (推荐) 或通过网页界面。
    *   若您使用的是 Antigravity，可直接使用 `/create-pr` 这 workflow。
    *   执行验证指令：
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   确保 PR 描述完整且包含双语对照 (AI 可以帮你翻译)。
    *   **Report**: 在 PR Description 中回馈验证结果 (Pass/Fail)。

## 📝 样式指南

*   **Commit Messages**: 遵循 Conventional Commits (`feat`, `fix`, `docs`, `refactor`...)。
    *   可以采用本项目头里的 `commit-message-helper` SKILL。
*   **Language**: 项目文档与沟通可采用您的原生语言，但代码注释与变量应使用英文。
*   **Code Style**: 保持一致性，参考现有代码风格。

## 🤝 寻求协助

*   如果你在过程中卡住了，请在 Issue 中留言。
*   善用 AI 询问："解释这段代码是什么意思？" 或 "我该如何测试这个功能？"。

期待你的贡献！让我们一起用 AI 打造更棒的软件。
