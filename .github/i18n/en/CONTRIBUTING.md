# Contributing to Arc-Like Chrome Extension

🎉 First off, thanks for taking the time to contribute!

We are dedicated to building a **low-barrier**, **AI-friendly** open source community. We highly encourage using AI tools (especially **Antigravity IDE**) to assist in development. Even if you are a coding novice or unfamiliar with this field, as long as you have an idea, you are welcome to contribute via our standardized process.

This document will guide you on how to turn a "vague wish" into a "usable feature".

## 🚀 Core Philosophy

1.  **AI-Native Development**: We embrace AI. Don't be afraid to let AI help you write code, documentation, or explain the architecture.
2.  **Spec-Driven Development (SDD)**: Think before you act. Specs first, code second. (`No Spec, No Code`)
3.  **Low Friction**: Using automated tools and clear SOPs to lower the barrier for contribution.

## 🛠 Tools

*   **IDE**: Highly recommended to use **Antigravity IDE** (AI-enhanced editor).
*   **Version Control**: Git & GitHub CLI (`gh`).
*   **Runtime**: Node.js & npm.

## 🛤 Developer SOP: From Idea to Implementation

We adopt a standardized **Spec-Driven Development (SDD)** process to help you complete development step by step.

### Phase 1: Idea & Issue

Everything starts with an idea.

1.  **Check Existing Issues**: See if anyone has proposed a similar idea.
2.  **Create Issue**:
    *   For new features, use the **Feature Request** template.
    *   For bug fixes, use the **Bug Report** template.
    *   *Tip: Even if the idea is vague, it's okay to open an Issue for discussion.*

### Phase 2: Analysis & Spec

Once the Issue is confirmed, we enter the SDD process. This is the best time to learn Domain Knowledge.

1.  **Start SDD Workflow**:
    At the project root, you can ask the AI Agent:
    > "I want to start developing Issue #123, please run /sdd-process for me"
    *   AI will create the standard directory: `/docs/specs/{type}/ISSUE-123_{desc}/`.

2.  **Draft PRD (Product Requirement Document)**:
    *   AI will assist you in creating `/docs/specs/.../PRD_spec.md`.
    *   You need to define: **What to do (User Stories)** and **Acceptance Criteria**.
    *   *Tip: Use AI to help you refine User Stories and edge cases.*

3.  **Draft SA (System Analysis)**:
    *   After PRD is approved, AI assists in creating `/docs/specs/.../SA_spec.md`.
    *   You need to define: **Technical Architecture**, **APIs**, **Data Flow**.
    *   **Traceability**: Ensure every design decision maps back to PRD requirements.

### Phase 3: Implementation

Once specs are finalized, it's happy coding time.

1.  **Pre-Code Check**:
    *   Confirm both PRD and SA status are **Approved**.

2.  **Let AI Write Code**:
    *   Feed `PRD_spec.md` and `SA_spec.md` to Antigravity/AI.
    *   Example Prompt: *"Please implement the other window rendering feature according to Task 1 in SA_spec.md."*

3.  **Living Documentation**:
    *   ⚠️ **Important**: If you find the design needs modification during implementation, **update the SA/PRD immediately**.
    *   Keep Specs and Code always in sync.

### Phase 4: Verification & PR

1.  **Self Review**:
    *   Run `npm test` to ensure tests pass.
    *   **Check Acceptance Criteria** in `PRD_spec.md` item by item.

2.  **Open Pull Request**:
    *   Use `gh` CLI to create PR (Recommended) or via web interface.
    *   If using Antigravity, you can use the `/create-pr` workflow directly.
    *   Run verification script:
        ```bash
        ./.agent/skills/pull-request/scripts/check-pr.sh
        ```
    *   Ensure PR description is complete and includes bilingual context (AI can help translate).
    *   **Report**: Report verification results (Pass/Fail) in the PR Description.

## 📝 Style Guides

*   **Commit Messages**: Follow Conventional Commits (`feat`, `fix`, `docs`, `refactor`...).
    *   You can use the `commit-message-helper` SKILL in this project.
*   **Language**: Project documentation and communication can use your native language, but code comments and variables should use English.
*   **Code Style**: Maintain consistency, refer to existing code style.

## 🤝 Seeking Help

*   If you get stuck, please comment on the Issue.
*   Don't hesitate to ask AI: "What does this code snippet mean?" or "How should I test this feature?".

Looking forward to your contribution! Let's build better software together with AI.
