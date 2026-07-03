# Arc-like Chrome Extension - Code Review Guidelines

## Project Context

This is a Chrome Extension (Manifest V3) providing an Arc-browser-style sidebar for tab and bookmark management.

**Tech Stack:**
- Vanilla JavaScript (ES6+)
- HTML5 / CSS3
- Chrome APIs: `chrome.sidePanel`, `chrome.tabs`, `chrome.tabGroups`, `chrome.bookmarks`, `chrome.storage`

**Architecture Pattern:**
- Modular structure under `modules/`
- Facade pattern for UI modules (`modules/uiManager.js`)
- Centralized icons in `modules/icons.js`

---

## Spec-Driven Development (SDD) Compliance

This project follows **tiered Spec-Driven Development** (spec weight proportional to risk). Source of truth for the tiering rules: `.agent/skills/sdd/SKILL.md`.

| Tier | Applies to | Artifact |
|---|---|---|
| **T0** | typo / copy / comments / trivial style / dependency bumps / obvious one-line fixes | No spec (background explained in commit body) |
| **T1** (default) | Regular bug fixes, small–medium features, local refactors | Single-file `SPEC.md`, reviewed together with the PR |
| **T2** | `chrome.storage` schema, manifest permissions, cross-context protocols, data-loss-risk logic, large features/refactors | `PRD_spec.md` + `SA_spec.md`, approved **before** implementation |

### Spec Location

Specs are stored in `/docs/specs/{feature|fix}/{ID_PREFIX}_{desc}/`:
- T1 → `SPEC.md` (single file)
- T2 → `PRD_spec.md` + `SA_spec.md`

**ID_PREFIX types:**
- `ISSUE-{num}`: Corresponds to GitHub Issue
- `PR-{num}`: External PR without Issue
- `BASE-{num}`: Initial or baseline specs

### Key Review Checks for SDD PRs

When a PR **includes changes to `docs/specs/**`**, verify:

1. **T1 (`SPEC.md`)**: Contains root-cause/background, chosen approach, impact map, test impact, and verifiable acceptance criteria — and matches the actual diff.

2. **T2 Requirement Traceability**: Check if `SA_spec.md` contains a Traceability Matrix that maps:
   - `Req ID` → `PRD Section` → `SA Section` → `Implementation File`

3. **T2 Implementation Files Match**: Verify that code files modified in the PR are listed in the SA's Traceability Matrix; new files should be marked as `[NEW]`.

4. **T2 Acceptance Criteria Coverage**: Review if PRD's Acceptance Criteria (Gherkin format) are addressed by the implementation.

### Skip Condition

> **If the PR does NOT include any changes to files under `docs/specs/`**, treat it as a T0 change: skip the SDD checks above and proceed with standard code review only (the commit body should still explain the background).

---

## Code Quality Standards

### JavaScript

- Use descriptive, intention-revealing variable names
- Functions should be focused and under 50 lines when possible
- Avoid hardcoded SVG/icons; use `modules/icons.js` instead
- Use `const` by default, `let` only when reassignment is needed
- Handle errors appropriately with try-catch for async operations

### Code Style

```javascript
// Prefer
const activeUsers = users.filter(user => user.isActive);

// Avoid
const x = users.filter(u => u.active);
```

### Chrome Extension Specific

- Always check API availability before use
- Use `chrome.i18n.getMessage()` for user-facing strings
- Store persistent data in `chrome.storage.sync` for cross-device sync

---

## Security Considerations

- Never hardcode secrets or API keys
- Validate all user inputs, especially for import/export features
- Use `style.setProperty()` for dynamic CSS, avoid `innerHTML` for user content

---

## Review Style

- Be specific and actionable in feedback
- Explain the "why" behind recommendations
- Acknowledge good patterns when observed
- Use Traditional Chinese (zh-TW) for comments when reviewing this repository
