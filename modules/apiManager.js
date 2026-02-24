// --- Chrome API Wrapper Module ---

// Wrappers for chrome.tabs API
export const getTabsInCurrentWindow = () => chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
export const getActiveTab = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
};
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

export async function addTabToNewGroup(tabIds, title, color, windowId = undefined) {
    // tabIds can be a single number or an array of numbers
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    const groupOptions = { tabIds: ids };
    if (windowId !== undefined) {
        groupOptions.createProperties = { windowId };
    }
    const groupId = await chrome.tabs.group(groupOptions);
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
let customMessages = null;
let currentCustomLang = 'auto';

/**
 * Parses and replaces placeholders like $1, $2 in a message string.
 */
function replacePlaceholders(message, substitutions) {
    if (!substitutions) return message;
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    let result = message;
    subs.forEach((sub, index) => {
        result = result.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
    });
    return result;
}

/**
 * Fetch and load custom i18n messages.json
 * @param {string} lang 
 */
export async function loadCustomI18n(lang) {
    currentCustomLang = lang || 'auto';
    if (currentCustomLang === 'auto') {
        customMessages = null;
        return;
    }
    try {
        const response = await fetch(chrome.runtime.getURL(`_locales/${currentCustomLang}/messages.json`));
        if (response.ok) {
            customMessages = await response.json();
            console.log(`[i18n] Loaded custom language: ${currentCustomLang}`);
        } else {
            console.warn(`[i18n] Failed to load language: ${currentCustomLang}, falling back to auto.`);
            customMessages = null;
            currentCustomLang = 'auto';
        }
    } catch (e) {
        console.error(`[i18n] Error loading language ${currentCustomLang}:`, e);
        customMessages = null;
        currentCustomLang = 'auto';
    }
}

/**
 * Gets the actual UI language being used (custom override or browser default).
 * @returns {string} Language code (e.g., 'en', 'zh-TW')
 */
export const getResolvedUILanguage = () => {
    if (currentCustomLang !== 'auto') {
        // Return standard BCP-47 tag, e.g., zh_TW -> zh-TW
        return currentCustomLang.replace('_', '-');
    }
    return chrome.i18n.getUILanguage();
};

export const getMessage = (key, substitutions) => {
    // 1. Try to get from custom loaded locale
    if (customMessages && customMessages[key] && customMessages[key].message !== undefined) {
        return replacePlaceholders(customMessages[key].message, substitutions);
    }
    // 2. Fallback to native Chrome API
    return chrome.i18n.getMessage(key, substitutions);
};

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

// Wrappers for chrome.readingList API
export const queryReadingList = (info = {}) => chrome.readingList.query(info);
export const addReadingListEntry = (options) => chrome.readingList.addEntry(options);
export const removeReadingListEntry = (options) => chrome.readingList.removeEntry(options);
export const updateReadingListEntry = (options) => chrome.readingList.updateEntry(options);

/**
 * Checks if a URL exists in the reading list.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>}
 */
export async function isInReadingList(url) {
    const entries = await queryReadingList({ url });
    return entries.length > 0;
}
