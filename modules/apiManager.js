// --- Chrome API Wrapper Module ---

// Wrappers for chrome.tabs API
export const getTabsInCurrentWindow = () => chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
export const moveTab = (tabId, index) => chrome.tabs.move(tabId, { index });
export const groupTabs = (tabIds, groupId) => chrome.tabs.group({ tabIds, groupId });
export const ungroupTabs = (tabIds) => chrome.tabs.ungroup(tabIds);
export const getTab = (tabId) => chrome.tabs.get(tabId);
export const removeTab = (tabId) => chrome.tabs.remove(tabId);
export const updateTab = (tabId, options) => chrome.tabs.update(tabId, options);
export const createTab = (options) => chrome.tabs.create(options);

// Wrappers for chrome.tabGroups API
export const getTabGroupsInCurrentWindow = () => chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
export const moveTabGroup = (groupId, index) => chrome.tabGroups.move(groupId, { index });
export const updateTabGroup = (groupId, options) => chrome.tabGroups.update(groupId, options);

// Wrappers for chrome.bookmarks API
export const getBookmarkTree = () => new Promise(resolve => chrome.bookmarks.getTree(resolve));
export const getBookmarkChildren = (parentId) => new Promise(resolve => chrome.bookmarks.getChildren(parentId, resolve));
export const createBookmark = (options) => chrome.bookmarks.create(options);
export const updateBookmark = (id, changes) => chrome.bookmarks.update(id, changes);
export const moveBookmark = (id, destination) => chrome.bookmarks.move(id, destination);
export const removeBookmark = (id) => new Promise(resolve => chrome.bookmarks.remove(id, resolve));
export const removeBookmarkTree = (id) => new Promise(resolve => chrome.bookmarks.removeTree(id, resolve));

// Wrappers for chrome.windows API
export const updateWindow = (windowId, options) => chrome.windows.update(windowId, options);

// Wrappers for chrome.i18n API
export const getMessage = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);

// Wrappers for chrome.storage API
export const getStorage = (area, keys) => {
    return new Promise((resolve) => {
        chrome.storage[area].get(keys, (result) => {
            resolve(result);
        });
    });
};

export const setStorage = (area, items) => {
    return new Promise((resolve) => {
        chrome.storage[area].set(items, () => {
            resolve();
        });
    });
};
