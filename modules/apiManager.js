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
export const getTabsInGroup = (groupId) => chrome.tabs.query({ groupId });

// Wrappers for chrome.tabGroups API
export const getTabGroupsInCurrentWindow = () => chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
export const getAllTabGroups = () => chrome.tabGroups.query({});
export const moveTabGroup = (groupId, index) => chrome.tabGroups.move(groupId, { index });
export const updateTabGroup = (groupId, options) => chrome.tabGroups.update(groupId, options);

export async function addTabToNewGroup(tabIds, title, color) {
    // tabIds can be a single number or an array of numbers
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    const groupId = await chrome.tabs.group({ tabIds: ids });
    await chrome.tabGroups.update(groupId, { title, color });
    return groupId;
}

// Wrappers for chrome.bookmarks API
export const getBookmarkTree = () => new Promise(resolve => chrome.bookmarks.getTree(resolve));
export const getBookmarkChildren = (parentId) => new Promise(resolve => chrome.bookmarks.getChildren(parentId, resolve));
export const getBookmark = (id) => new Promise(resolve => chrome.bookmarks.get(id, (results) => resolve(results[0])));
export const createBookmark = (options) => chrome.bookmarks.create(options);
export const updateBookmark = (id, changes) => chrome.bookmarks.update(id, changes);
export const moveBookmark = (id, destination) => chrome.bookmarks.move(id, destination);
export const removeBookmark = (id) => new Promise(resolve => chrome.bookmarks.remove(id, resolve));
export const removeBookmarkTree = (id) => new Promise(resolve => chrome.bookmarks.removeTree(id, resolve));
export const getSubTree = (id) => new Promise(resolve => chrome.bookmarks.getSubTree(id, resolve));

export async function searchBookmarksByUrl(url) {
    const results = await new Promise(resolve => chrome.bookmarks.search({ url }, resolve));
    return results.length > 0 ? results[0] : null;
}

// Wrappers for chrome.windows API
export const updateWindow = (windowId, options) => chrome.windows.update(windowId, options);
export const getCurrentWindow = () => chrome.windows.getCurrent();
export const getAllWindowsWithTabs = () => chrome.windows.getAll({ populate: true });
export const getAllWindows = () => chrome.windows.getAll({ populate: false });

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
