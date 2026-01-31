## 2024-05-22 - Cache DOM queries for Tab Rendering & Search
**Issue:** Search filtering and tab updates were repeatedly calling `querySelector` on every tab element to access title, favicon, and wrapper elements. In a list of hundreds of tabs, this added significant overhead during search input (debounced) and updates.
**Solution:** Refactored `createTabElement` (in `tabRenderer.js`) and `createOtherWindowTabElement` (in `otherWindowRenderer.js`) to attach a `_refs` object to the `tabItem` DOM node. This object caches direct references to child elements. Updated `updateTabElement` and `searchManager.js` to use these cached references.
**Impact:** Reduced DOM query overhead to O(1) for cached elements. Smoother search filtering experience.
