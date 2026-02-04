# Bolt Performance Log

## 2026-01-22 - Search Filtering Optimization
**Issue:** Redundant DOM Layout Thrashing in `filterBookmarks` and inefficient `querySelectorAll` in `filterOtherWindowsTabs`.
**Solution:** Removed redundant display enforcement in `filterBookmarks` (handled by `renderBookmarks`). Implemented caching for Other Windows headers and folders to replace DOM queries.
**Impact:** Reduced Layout Thrashing during search input; eliminated O(N) DOM queries for window/group headers.

## 2026-02-03 - DOM Recycling for Bookmarks
**Issue:** Search filtering in bookmarks was causing frequent `innerHTML = ''` and full DOM recreation, leading to potential layout thrashing and high GC pressure, especially with large bookmark trees.
**Solution:** Implemented DOM recycling in `modules/ui/bookmarkRenderer.js` using `bookmarkElementsCache` (Map). Extracted element creation into `getOrCreateBookmarkElement` and `getOrCreateFolderElement` to reuse existing DOM nodes when possible, updating only changed attributes (highlighting, text).
**Impact:** Significantly reduced `createElement` calls during search filtering and folder expansion. Visual updates are smoother as elements are reused rather than destroyed and recreated.
