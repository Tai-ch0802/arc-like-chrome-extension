# Project Context & Agent Guidelines

This file serves as the primary context source for AI agents working on this repository. It works in tandem with the detailed rules located in `.agent/rules/`.

> **IMPORTANT**: This file must be kept in strong consistency with the contents of `.agent/rules`. Any major architectural change or rule update must be reflected here.

## Project Overview
This is an **Arc-style Chrome Sidebar Extension** providing vertical tabs and bookmark management.
- **Type**: Chrome Extension (Manifest V3)
- **Core Tech**: Vanilla JS, HTML5, CSS3
- **Build**: `make` (requires `jq`)

## Rule Index
Detailed behavioral rules are defined in `.agent/rules/`. Agents **MUST** consult these files for specific tasks:

- **[Overview](.agent/rules/RULE_001_PROJECT_OVERVIEW.md)**: Project metadata, tech stack, and tags.
- **[Architecture](.agent/rules/RULE_002_ARCHITECTURE.md)**: File responsibilities, module roles (e.g., `sidepanel.js` as Controller), and design patterns.
- **[Build & Deploy](.agent/rules/RULE_003_BUILD_AND_DEPLOY.md)**: Instructions for `make`, previewing in Chrome, and packaging.
- **[Commit & Release](.agent/rules/RULE_004_COMMIT_AND_RELEASE.md)**: Conventional Commits (English Subject, Traditional Chinese Body) and Release Note styles.
- **[Development Guidelines](.agent/rules/RULE_005_DEVELOPMENT_GUIDELINES.md)**: Impact analysis, Context Engineering (`.agent/notes/NOTE_*.md`), and coding standards.
- **[PR Review Guidelines](.agent/rules/RULE_006_PR_REVIEW_GUIDELINES.md)**: Standard procedure for PR reviews (zh-TW, gh CLI, signature).

## Core Interaction Principles
1. **Language**: Traditional Chinese (zh-TW) for conversation and commit bodies. English for commit subjects and code comments.
2. **Context**: Always update `.agent/notes/NOTE_YYYYMMDD.md` at the end of a session.
3. **Consistency**: Ensure `AGENTS.md` and `.agent/rules` remain synchronized.
