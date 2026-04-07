# Bolt Performance Log

## 2026-01-22 - Search Filtering Optimization
**Issue:** Redundant DOM Layout Thrashing in `filterBookmarks` and inefficient `querySelectorAll` in `filterOtherWindowsTabs`.
**Solution:** Removed redundant display enforcement in `filterBookmarks` (handled by `renderBookmarks`). Implemented caching for Other Windows headers and folders to replace DOM queries.
**Impact:** Reduced Layout Thrashing during search input; eliminated O(N) DOM queries for window/group headers.

## 2026-02-03 - DOM Recycling for Bookmarks
**Issue:** Search filtering in bookmarks was causing frequent `innerHTML = ''` and full DOM recreation, leading to potential layout thrashing and high GC pressure, especially with large bookmark trees.
**Solution:** Implemented DOM recycling in `modules/ui/bookmarkRenderer.js` using `bookmarkElementsCache` (Map). Extracted element creation into `getOrCreateBookmarkElement` and `getOrCreateFolderElement` to reuse existing DOM nodes when possible, updating only changed attributes (highlighting, text).
**Impact:** Significantly reduced `createElement` calls during search filtering and folder expansion. Visual updates are smoother as elements are reused rather than destroyed and recreated.

## 2026-02-07 - Bookmark Folder Reconciliation
**Issue:** `renderBookmarks` was using `innerHTML = ''` to clear folder content before re-rendering recursively, destroying the cached DOM tree structure within folders even if the items were recycled.
**Solution:** Replaced `innerHTML = ''` and `appendChild` with `reconcileDOM` in `modules/ui/bookmarkRenderer.js`. This allows the application to reuse the entire nested DOM tree for folders during updates and search filtering.
**Impact:** `handleSearch` execution time improved by ~13% (135ms -> 118ms) in benchmarks. More importantly, it prevents large-scale DOM detachment and re-attachment for deep folder structures.

## 2026-04-06 - Reading List DOM Reconciliation
**Issue:** `renderReadingList` used synchronous `innerHTML = ''` to clear the list before an async storage fetch, causing UI flicker. Rapid successive calls could also result in stale async callbacks overwriting newer render results (race condition). Dead code (`const fragment`) and inconsistent DOM operations (delete handler using `appendChild` vs `reconcileDOM`) also needed cleanup.
**Solution:** Migrated from `innerHTML = ''` and `DocumentFragment` to the unified `reconcileDOM` pattern. Introduced a `readingListSearchGeneration` counter (modeled after `searchManager.js`'s `bookmarkSearchGeneration`) to discard stale async results. Cached the empty state element via `getReadingListEmptyState()` (with `isConnected` check to handle detached nodes) for effective reconcileDOM reuse. Unified the delete-last-item fallback to use `reconcileDOM` with `updateClearAllReadButton(false)`. Removed dead code (`const fragment`).
**Impact:** Eliminated UI flicker, properly guarded against race conditions from rapid re-renders, removed dead code, and unified DOM operation patterns across the module.
