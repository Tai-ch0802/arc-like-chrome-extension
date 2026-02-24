## 2025-02-16 - RSS Subscription Management UX Improvement
**Learning:** Destructive actions in settings panels often lack confirmation, which can lead to frustrating data loss. Also, dynamic content in modals (like RSS titles) requires careful XSS handling and proper `aria-label` for icon-only buttons is crucial for accessibility but easily overlooked in dynamically generated lists.
**Action:** Always check for confirmation steps on delete actions during UX audits. When implementing confirmation dialogs, ensure the `modalManager` supports dynamic messages and that user input is escaped. Verify that all icon buttons have both `title` and `aria-label`.

## 2025-02-18 - Empty Folder State Improvement
**Learning:** Empty states are opportunities for guidance. Users often create folders to immediately add content. Providing a "Add Current Tab" button reduces friction significantly compared to drag-and-drop or context menus.
**Action:** Look for other empty states (e.g., Reading List, Search Results) where a primary action can be surfaced.
