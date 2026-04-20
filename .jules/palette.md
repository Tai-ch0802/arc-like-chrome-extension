## 2025-02-16 - RSS Subscription Management UX Improvement
**Learning:** Destructive actions in settings panels often lack confirmation, which can lead to frustrating data loss. Also, dynamic content in modals (like RSS titles) requires careful XSS handling and proper `aria-label` for icon-only buttons is crucial for accessibility but easily overlooked in dynamically generated lists.
**Action:** Always check for confirmation steps on delete actions during UX audits. When implementing confirmation dialogs, ensure the `modalManager` supports dynamic messages and that user input is escaped. Verify that all icon buttons have both `title` and `aria-label`.

## 2025-02-18 - Empty Folder State Improvement
**Learning:** Empty states are opportunities for guidance. Users often create folders to immediately add content. Providing a "Add Current Tab" button reduces friction significantly compared to drag-and-drop or context menus.
**Action:** Look for other empty states (e.g., Reading List, Search Results) where a primary action can be surfaced.

## 2025-02-18 - Draggable Cursor UX Improvement
**Learning:** Elements that can be dragged often lack visual affordances indicating they are draggable until the user tries to drag them. Changing the default cursor to a "grab" hand cursor provides an immediate and clear signifier of interactivity without cluttering the UI.
**Action:** When implementing or reviewing drag-and-drop features, always ensure that draggable items explicitly use `cursor: grab` and active dragging states use `cursor: grabbing` to communicate state clearly to the user.
