// --- Chrome API Wrapper Module ---
import {
    CAP_TAB_GROUPS,
    CAP_SIDE_PANEL,
    classifyTabGroupFailure,
    isTransientTabGroupError,
    createCapabilityStore,
    getBrowserInfo,
} from './utils/browserCapabilities.js';

// Wrappers for chrome.tabs API
export const getTabsInCurrentWindow = () => chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
export const getActiveTab = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
};
export const moveTab = (tabId, index) => chrome.tabs.move(tabId, { index });
export const getTab = (tabId) => chrome.tabs.get(tabId);
export const removeTab = (tabId) => chrome.tabs.remove(tabId);
export const updateTab = (tabId, options) => chrome.tabs.update(tabId, options);
export const createTab = (options) => chrome.tabs.create(options);
export const getTabsInGroup = (groupId) => chrome.tabs.query({ groupId });

// --- Browser capability flags (ISSUE-257) ---------------------------------
// Per-device flags in chrome.storage.local, never synced. Created lazily so
// the storage wrappers further down are initialised first (ES const TDZ).
let capabilityStore = null;
function getCapabilityStore() {
    if (!capabilityStore) {
        capabilityStore = createCapabilityStore({
            storage: {
                get: (k) => getStorage('local', [k]).then((r) => r[k]),
                set: (k, v) => setStorage('local', { [k]: v }),
                remove: (k) => removeStorage('local', k),
            },
            getInfo: getBrowserInfo,
        });
        // A flag written in another context (sidepanel vs SW vs options) must
        // not be masked by this context's cache.
        try {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local') return;
                for (const name of [CAP_TAB_GROUPS, CAP_SIDE_PANEL]) {
                    if (changes[name]) capabilityStore.invalidate(name);
                }
            });
        } catch { /* environments without storage.onChanged (tests) */ }
    }
    return capabilityStore;
}

/** @returns {Promise<boolean>} false once tab groups were observed broken here (Dia). */
export const isTabGroupingAvailable = async () => !(await getCapabilityStore().isUnsupported(CAP_TAB_GROUPS));
/** @returns {Promise<boolean>} true once opening the side panel failed here. */
export const isSidePanelUnavailable = () => getCapabilityStore().isUnsupported(CAP_SIDE_PANEL);
/** @param {string} [reason] why (e.g. 'open-rejected: …' / 'no-onOpened'), shown in options */
export const markSidePanelUnavailable = (reason) => getCapabilityStore().markUnsupported(CAP_SIDE_PANEL, reason ? { reason } : {});
/** @returns {Promise<string>} the recorded reason, or '' */
export const getSidePanelUnavailableReason = async () => {
    const flag = await getCapabilityStore().getFlag(CAP_SIDE_PANEL);
    return (flag && flag.reason) || '';
};
/** Call at SW startup: drops flags recorded by another brand / major version. */
export const resetCapabilityFlagsIfBrowserChanged = () => getCapabilityStore().resetIfBrowserChanged();
/** Call from a storage.onChanged handler so a flag written elsewhere is seen. */
export const invalidateCapabilityFlag = (name) => getCapabilityStore().invalidate(name);

/**
 * Tab-group operations are BEST-EFFORT (PRD FR-1.01/1.03): Dia rejects every
 * chrome.tabs.group() with "No window". A failure resolves to null instead of
 * throwing so callers finish their remaining steps (mark reading-list item
 * read, open the rest of a workspace, …). The Dia-specific error — or a
 * streak of failures on a non-Chrome brand — records the unsupported flag;
 * Chrome's transient errors never do (see classifyTabGroupFailure).
 */
// Only chrome.tabs.group (create/join) failures count toward the streak:
// ungroup/move/update fail for ordinary reasons (stale ids, collapsed state)
// and say nothing about whether this browser can group at all.
let tabGroupFailStreak = 0;
async function guardTabGroupOp(label, fn, { countsTowardStreak = false } = {}) {
    try {
        const result = await fn();
        if (countsTowardStreak) tabGroupFailStreak = 0;
        return result;
    } catch (err) {
        const message = err && err.message;
        if (countsTowardStreak && !isTransientTabGroupError(message)) tabGroupFailStreak += 1;
        if (countsTowardStreak && classifyTabGroupFailure(message, getBrowserInfo(), tabGroupFailStreak)) {
            try { await getCapabilityStore().markUnsupported(CAP_TAB_GROUPS); } catch { /* best-effort */ }
        }
        console.warn(`[tabGroups] ${label} failed:`, message);
        return null;
    }
}

export const groupTabs = (tabIds, groupId) => guardTabGroupOp('group', () => chrome.tabs.group({ tabIds, groupId }), { countsTowardStreak: true });
export const ungroupTabs = (tabIds) => guardTabGroupOp('ungroup', () => chrome.tabs.ungroup(tabIds));

// Wrappers for chrome.tabGroups API (queries degrade to [] where the API is absent/broken)
export const getTabGroupsInCurrentWindow = () => Promise.resolve()
    .then(() => chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }))
    .catch(() => []);
export const getAllTabGroups = () => Promise.resolve().then(() => chrome.tabGroups.query({})).catch(() => []);
export const moveTabGroup = (groupId, index) => guardTabGroupOp('move', () => chrome.tabGroups.move(groupId, { index }));
export const updateTabGroup = (groupId, options) => guardTabGroupOp('update', () => chrome.tabGroups.update(groupId, options));

/**
 * Create a new group from `tabIds` and title/color it.
 * @returns {Promise<number|null>} the new group id, or null when grouping is
 *   unavailable on this browser (flag already set) or the group could not be
 *   created. A group that was created but could not be titled/colored still
 *   returns its id (the caller owns it, e.g. for undo).
 */
export async function addTabToNewGroup(tabIds, title, color, windowId = undefined) {
    if (!(await isTabGroupingAvailable())) return null;
    // tabIds can be a single number or an array of numbers
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    const groupOptions = { tabIds: ids };
    if (windowId !== undefined) {
        groupOptions.createProperties = { windowId };
    }
    const groupId = await guardTabGroupOp('create', () => chrome.tabs.group(groupOptions), { countsTowardStreak: true });
    if (groupId == null) return null;
    await updateTabGroup(groupId, { title, color });
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
 * Resolves a custom-loaded message entry (with named placeholders) using substitutions.
 *
 * Chrome i18n messages.json uses named placeholders in the message string, e.g.:
 *   "message": "Delete \"$bookmark_title$\"?"
 *   "placeholders": { "bookmark_title": { "content": "$1" } }
 *
 * This function:
 *  1. Builds a map from placeholder name -> positional index from the `placeholders` block.
 *  2. Replaces each `$PLACEHOLDER_NAME$` in the message with the corresponding substitution.
 *  3. As a fallback, also replaces bare `$1`, `$2`, etc. for simpler message formats.
 *
 * @param {object} entry - The full message entry object { message, placeholders? }
 * @param {string|string[]} [substitutions] - Substitution values
 * @returns {string}
 */
function resolveCustomMessage(entry, substitutions) {
    let msg = entry.message;
    if (!substitutions) return msg;

    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];

    // Step 1: Resolve named placeholders via the "placeholders" block
    if (entry.placeholders) {
        for (const [name, def] of Object.entries(entry.placeholders)) {
            if (!def || !def.content) continue;
            // def.content is like "$1", "$2", etc. Extract the index.
            const indexMatch = def.content.match(/^\$(\d+)$/);
            if (indexMatch) {
                const idx = parseInt(indexMatch[1], 10) - 1;
                const value = idx >= 0 && idx < subs.length ? subs[idx] : '';
                // Replace $name$ (case-insensitive, as Chrome does)
                const pattern = new RegExp(`\\$${name}\\$`, 'gi');
                msg = msg.replace(pattern, value);
            }
        }
    }

    // Step 2: Fallback — replace bare $1, $2, etc. directly (for simpler messages)
    subs.forEach((sub, index) => {
        msg = msg.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
    });

    return msg;
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
        return resolveCustomMessage(customMessages[key], substitutions);
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

/**
 * Strict variant of setStorage that surfaces Chrome storage errors (sync
 * quota exceeded, runtime errors) by rejecting the Promise instead of
 * silently resolving.
 *
 * Use when the caller MUST know whether the write succeeded — e.g. before
 * deleting the only remaining backup of the same data (Phase 9 workspace
 * migration).
 *
 * Existing setStorage stays silent-on-failure to avoid retroactively turning
 * dozens of fire-and-forget callers into unhandled rejections.
 *
 * @param {'sync'|'local'} area
 * @param {object} items
 * @returns {Promise<void>}
 */
export const setStorageStrict = (area, items) => {
    return new Promise((resolve, reject) => {
        chrome.storage[area].set(items, () => {
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message || 'chrome.storage.set failed'));
            else resolve();
        });
    });
};

/**
 * Remove key(s) from a storage area. Resolves regardless of outcome but logs
 * lastError loudly — a silent sync-area removal failure can suppress the
 * onChanged event downstream logic depends on (e.g. workspace delete tombstones).
 * @param {'sync'|'local'} area
 * @param {string|string[]} keys
 */
export const removeStorage = (area, keys) => {
    return new Promise((resolve) => {
        chrome.storage[area].remove(keys, () => {
            const err = chrome.runtime.lastError;
            if (err) console.warn(`[storage] ${area}.remove failed:`, err.message);
            resolve();
        });
    });
};

// Wrappers for chrome.readingList API
// --- Runtime Messaging & Pages API ---
export const sendRuntimeMessage = (message) => chrome.runtime.sendMessage(message);
export const addRuntimeMessageListener = (listener) => chrome.runtime.onMessage.addListener(listener);
export const openOptionsPage = () => chrome.runtime.openOptionsPage();

/** chrome.readingList exists on Chrome and Dia; other Chromium brands may lack it (ISSUE-257 FR-4.05). */
export const hasReadingListApi = () => typeof chrome !== 'undefined' && Boolean(chrome.readingList && chrome.readingList.query);
export const queryReadingList = (info = {}) => (hasReadingListApi() ? chrome.readingList.query(info) : Promise.resolve([]));
export const addReadingListEntry = (options) => (hasReadingListApi() ? chrome.readingList.addEntry(options) : Promise.resolve());
export const removeReadingListEntry = (options) => (hasReadingListApi() ? chrome.readingList.removeEntry(options) : Promise.resolve());
export const updateReadingListEntry = (options) => (hasReadingListApi() ? chrome.readingList.updateEntry(options) : Promise.resolve());

/**
 * Checks if a URL exists in the reading list.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>}
 */
export async function isInReadingList(url) {
    const entries = await queryReadingList({ url });
    return entries.length > 0;
}
