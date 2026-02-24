import { getStorage, setStorage, getAllWindows } from './apiManager.js';

// --- Smart Auto-Grouping Undo State ---

let lastAutoGroupState = {
  canUndo: false,
  timestamp: null,
  affectedTabs: [], // 被移動的分頁 ID 陣列
  createdGroups: [] // 新建的群組 ID 陣列
};

export function setLastAutoGroupState(state) {
  lastAutoGroupState = {
    canUndo: true,
    timestamp: Date.now(),
    affectedTabs: state.affectedTabs || [],
    createdGroups: state.createdGroups || []
  };
}

export function getLastAutoGroupState() {
  return lastAutoGroupState;
}

export function clearLastAutoGroupState() {
  lastAutoGroupState = {
    canUndo: false,
    timestamp: null,
    affectedTabs: [],
    createdGroups: []
  };
}

// --- UI State Management Module ---

const expandedBookmarkFolders = new Set();

export const isFolderExpanded = (folderId) => expandedBookmarkFolders.has(folderId);

export const addExpandedFolder = (folderId) => expandedBookmarkFolders.add(folderId);

export const removeExpandedFolder = (folderId) => expandedBookmarkFolders.delete(folderId);

export const clearExpandedFolders = () => expandedBookmarkFolders.clear();


// --- Window Naming State ---

const WINDOW_NAMES_STORAGE_KEY = 'windowNames';
let windowNames = {}; // In-memory cache of { windowId: "Custom Name" }

/**
 * Loads the window names mapping from chrome.storage.local into the in-memory cache.
 */
export async function initWindowNames() {
  const result = await getStorage('local', [WINDOW_NAMES_STORAGE_KEY]);
  windowNames = result[WINDOW_NAMES_STORAGE_KEY] || {};
}

/**
 * Saves the in-memory window names mapping to chrome.storage.local.
 * @private
 */
function _saveWindowNames() {
  return setStorage('local', { [WINDOW_NAMES_STORAGE_KEY]: windowNames });
}

/**
 * Gets the custom name for a specific window.
 * @param {number} windowId
 * @returns {string|undefined}
 */
export function getWindowName(windowId) {
  return windowNames[windowId];
}

/**
 * Sets the custom name for a specific window.
 * @param {number} windowId
 * @param {string} name
 */
export async function setWindowName(windowId, name) {
  if (name && name.trim().length > 0) {
    windowNames[windowId] = name.trim();
  } else {
    delete windowNames[windowId];
  }
  await _saveWindowNames();
}

/**
 * Removes the custom name for a specific window.
 * @param {number} windowId
 */
export async function removeWindowName(windowId) {
  if (windowNames[windowId]) {
    delete windowNames[windowId];
    await _saveWindowNames();
  }
}

/**
 * Prunes window names that correspond to non-existent windows.
 */
export async function pruneWindowNames() {
  const allWindows = await getAllWindows();
  const activeWindowIds = new Set(allWindows.map(w => w.id.toString()));

  let changed = false;
  Object.keys(windowNames).forEach(storedId => {
    if (!activeWindowIds.has(storedId.toString())) {
      delete windowNames[storedId];
      changed = true;
    }
  });

  if (changed) {
    await _saveWindowNames();
    console.log('Pruned stale window names');
  }
}

// --- Reading List Visibility State ---

const READING_LIST_VISIBLE_KEY = 'readingListVisible';
let readingListVisible = true; // Default to visible

/**
 * Loads the Reading List visibility state from chrome.storage.sync.
 * @returns {Promise<boolean>} The visibility state.
 */
export async function initReadingListVisibility() {
  const result = await getStorage('sync', [READING_LIST_VISIBLE_KEY]);
  readingListVisible = result[READING_LIST_VISIBLE_KEY] !== false; // Default true if not set
  return readingListVisible;
}

/**
 * Gets the current Reading List visibility state from in-memory cache.
 * @returns {boolean} True if Reading List should be visible.
 */
export function isReadingListVisible() {
  return readingListVisible;
}

/**
 * Sets the Reading List visibility state.
 * @param {boolean} visible - Whether the Reading List should be visible.
 */
export async function setReadingListVisible(visible) {
  readingListVisible = visible;
  await setStorage('sync', { [READING_LIST_VISIBLE_KEY]: visible });
}

// --- Bookmark-Tab Linking State ---

const LINKED_TABS_STORAGE_KEY = 'linkedTabs';
let linkedTabs = {}; // In-memory cache of { bookmarkId: [tabId1, tabId2, ...] }
let tabToBookmarkMap = {}; // In-memory reverse map of { tabId: bookmarkId } for quick lookups.

/**
 * Loads the linked tabs mapping from chrome.storage.local into the in-memory cache.
 */
export async function initLinkedTabs() {
  const result = await getStorage('local', [LINKED_TABS_STORAGE_KEY]);
  linkedTabs = result[LINKED_TABS_STORAGE_KEY] || {};
  _buildTabToBookmarkMap();
}

/**
 * Builds the reverse mapping from tab IDs to bookmark IDs for quick lookups.
 * @private
 */
function _buildTabToBookmarkMap() {
  tabToBookmarkMap = {};
  for (const bookmarkId in linkedTabs) {
    for (const tabId of linkedTabs[bookmarkId]) {
      tabToBookmarkMap[tabId] = bookmarkId;
    }
  }
}

/**
 * Saves the in-memory linked tabs mapping to chrome.storage.local.
 * @private
 */
function _saveLinkedTabs() {
  return setStorage('local', { [LINKED_TABS_STORAGE_KEY]: linkedTabs });
}

/**
 * Associates a tab with a bookmark.
 * @param {string} bookmarkId - The ID of the bookmark.
 * @param {number} tabId - The ID of the tab.
 */
export async function addLinkedTab(bookmarkId, tabId) {
  if (!linkedTabs[bookmarkId]) {
    linkedTabs[bookmarkId] = [];
  }
  // Avoid adding duplicates
  if (!linkedTabs[bookmarkId].includes(tabId)) {
    linkedTabs[bookmarkId].push(tabId);
    tabToBookmarkMap[tabId] = bookmarkId; // Update reverse map
    await _saveLinkedTabs();
  }
}

/**
 * Removes a tab's link association by its ID.
 * @param {number} tabId - The ID of the tab to remove.
 * @returns {Promise<string|null>} The bookmarkId the tab was linked to, or null if not found.
 */
export async function removeLinkedTabByTabId(tabId) {
  const bookmarkId = getBookmarkIdByTabId(tabId);
  if (bookmarkId) {
    linkedTabs[bookmarkId] = linkedTabs[bookmarkId].filter(t => t !== tabId);
    delete tabToBookmarkMap[tabId]; // Update reverse map
    if (linkedTabs[bookmarkId].length === 0) {
      delete linkedTabs[bookmarkId];
    }
    await _saveLinkedTabs();
    return bookmarkId;
  }
  return null;
}

/**
 * Removes all tab links associated with a specific bookmark.
 * @param {string} bookmarkId - The ID of the bookmark.
 */
export async function removeLinksByBookmarkId(bookmarkId) {
  if (linkedTabs[bookmarkId]) {
    // Update reverse map before deleting
    for (const tabId of linkedTabs[bookmarkId]) {
      delete tabToBookmarkMap[tabId];
    }
    delete linkedTabs[bookmarkId];
    await _saveLinkedTabs();
  }
}

/**
 * Retrieves all tab IDs linked to a specific bookmark.
 * @param {string} bookmarkId - The ID of the bookmark.
 * @returns {number[]} An array of tab IDs, or an empty array if none.
 */
export const getLinkedTabsByBookmarkId = (bookmarkId) => {
  return linkedTabs[bookmarkId] || [];
};

/**
 * Finds the bookmark ID associated with a given tab ID using the reverse map.
 * @param {number} tabId - The ID of the tab.
 * @returns {string|null} The bookmark ID, or null if not found.
 */
export const getBookmarkIdByTabId = (tabId) => {
  return tabToBookmarkMap[tabId] || null;
};

/**
 * Returns the entire linked tabs object.
 * @returns {Object} The linked tabs mapping.
 */
export const getAllLinkedTabs = () => {
  return linkedTabs;
};


// --- Bookmark Search Cache ---

const BOOKMARK_CACHE_KEY = 'arc_sidebar_bookmark_cache';
let bookmarkCache = []; // In-memory cache: [{ id, title, url, parentId, type, path }, ...]
let bookmarkTreeCache = null; // In-memory cache of the full tree structure

/**
 * Flattens a bookmark tree into a searchable array with path information.
 * @param {Array} nodes - Bookmark tree nodes.
 * @param {Array} pathStack - Current path stack (folder names).
 * @returns {Array} Flat array of bookmark items.
 */
function flattenBookmarkTree(nodes, pathStack = [], result = []) {
  for (const node of nodes) {
    if (node.url) {
      // Bookmark item
      result.push({
        id: node.id,
        title: node.title || '',
        url: node.url,
        parentId: node.parentId,
        type: 'bookmark',
        path: [...pathStack]
      });
    } else if (node.children) {
      // Folder
      result.push({
        id: node.id,
        title: node.title || '',
        url: null,
        parentId: node.parentId,
        type: 'folder',
        path: [...pathStack]
      });
      // Recurse into children with updated path
      pathStack.push(node.title);
      flattenBookmarkTree(node.children, pathStack, result);
      pathStack.pop();
    }
  }
  return result;
}

/**
 * Builds the bookmark cache from the Chrome bookmark tree and saves to localStorage.
 */
export async function buildBookmarkCache() {
  try {
    const tree = await chrome.bookmarks.getTree();
    if (tree[0] && tree[0].children) {
      bookmarkTreeCache = tree;
      bookmarkCache = flattenBookmarkTree(tree[0].children, [], []);
      await setStorage('local', { [BOOKMARK_CACHE_KEY]: bookmarkCache });
    }
  } catch (error) {
    console.error('[stateManager] Error building bookmark cache:', error);
  }
}

/**
 * Loads the bookmark cache from storage into memory.
 */
export async function loadBookmarkCache() {
  try {
    const result = await getStorage('local', [BOOKMARK_CACHE_KEY]);
    const cached = result[BOOKMARK_CACHE_KEY];
    if (cached) {
      bookmarkCache = cached;
    }
  } catch (error) {
    console.error('[stateManager] Error loading bookmark cache:', error);
    bookmarkCache = [];
  }
}

/**
 * Returns the in-memory bookmark cache.
 * @returns {Array} The flattened bookmark cache.
 */
export function getBookmarkCache() {
  return bookmarkCache;
}

/**
 * Returns the in-memory bookmark tree cache.
 * @returns {Array|null} The bookmark tree structure.
 */
export function getBookmarkTreeFromCache() {
  return bookmarkTreeCache;
}
