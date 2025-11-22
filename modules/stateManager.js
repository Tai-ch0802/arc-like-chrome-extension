import { getStorage, setStorage } from './apiManager.js';

// --- UI State Management Module ---

const expandedBookmarkFolders = new Set();

export const isFolderExpanded = (folderId) => expandedBookmarkFolders.has(folderId);

export const addExpandedFolder = (folderId) => expandedBookmarkFolders.add(folderId);

export const removeExpandedFolder = (folderId) => expandedBookmarkFolders.delete(folderId);

export const clearExpandedFolders = () => expandedBookmarkFolders.clear();


// --- Bookmark-Tab Linking State ---

const LINKED_TABS_STORAGE_KEY = 'linkedTabs';
let linkedTabs = {}; // In-memory cache of { bookmarkId: [tabId1, tabId2, ...] }

/**
 * Loads the linked tabs mapping from chrome.storage.local into the in-memory cache.
 */
export async function initLinkedTabs() {
  const result = await getStorage('local', [LINKED_TABS_STORAGE_KEY]);
  linkedTabs = result[LINKED_TABS_STORAGE_KEY] || {};
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
 * Finds the bookmark ID associated with a given tab ID.
 * @param {number} tabId - The ID of the tab.
 * @returns {string|null} The bookmark ID, or null if not found.
 */
export const getBookmarkIdByTabId = (tabId) => {
  for (const bookmarkId in linkedTabs) {
    if (linkedTabs[bookmarkId].includes(tabId)) {
      return bookmarkId;
    }
  }
  return null;
};

/**
 * Returns the entire linked tabs object.
 * @returns {Object} The linked tabs mapping.
 */
export const getAllLinkedTabs = () => {
  return linkedTabs;
};

// Feature Toggle for Virtual Scrolling (Beta)
let isVirtualScrolling = false;

export async function initVirtualScrolling() {
  const result = await getStorage('sync', { virtualScrolling: false });
  isVirtualScrolling = result.virtualScrolling;
}

export function isVirtualScrollingEnabled() {
  return isVirtualScrolling;
}

export async function setVirtualScrollingEnabled(enabled) {
  isVirtualScrolling = enabled;
  await setStorage('sync', { virtualScrolling: enabled });
}
