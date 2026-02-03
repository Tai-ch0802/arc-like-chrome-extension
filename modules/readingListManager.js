// --- Reading List Manager Module ---
// Business logic for Reading List operations

import * as api from './apiManager.js';
import { markAsFetched } from './rssManager.js';

/**
 * Group name for tabs opened from reading list.
 * Uses i18n with fallback to English.
 */
const READING_LIST_GROUP_NAME = api.getMessage('readingListGroupName') || 'From Reading List';

/**
 * Opens a reading list item in a new tab and adds it to the "From Reading List" group.
 * Also marks the item as read.
 * @param {Object} entry - The reading list entry to open.
 * @param {string} entry.url - The URL of the entry.
 * @param {string} entry.title - The title of the entry.
 * @returns {Promise<chrome.tabs.Tab>} The created tab.
 */
export async function openReadingListItem(entry) {
    // Create a new tab with the URL
    const tab = await api.createTab({ url: entry.url, active: true });

    // Find an existing "From Reading List" group or create a new one with this tab
    await addTabToReadingListGroup(tab.id);

    // Mark the entry as read
    await api.updateReadingListEntry({ url: entry.url, hasBeenRead: true });

    return tab;
}

/**
 * Finds an existing "From Reading List" group ID if it exists.
 * @returns {Promise<number|null>} The group ID, or null if no group exists.
 */
async function findReadingListGroup() {
    const groups = await api.getTabGroupsInCurrentWindow();
    const existingGroup = groups.find(g => g.title === READING_LIST_GROUP_NAME);
    return existingGroup ? existingGroup.id : null;
}

/**
 * Adds a tab to the reading list group, creating the group if needed.
 * @param {number} tabId - The tab ID to add.
 * @returns {Promise<number>} The group ID.
 */
export async function addTabToReadingListGroup(tabId) {
    const groups = await api.getTabGroupsInCurrentWindow();
    const existingGroup = groups.find(g => g.title === READING_LIST_GROUP_NAME);

    if (existingGroup) {
        await api.groupTabs([tabId], existingGroup.id);
        return existingGroup.id;
    }

    // Create a new group with the tab
    return await api.addTabToNewGroup([tabId], READING_LIST_GROUP_NAME, 'blue');
}

/**
 * Toggles the read status of a reading list entry.
 * @param {string} url - The URL of the entry.
 * @param {boolean} hasBeenRead - The new read status.
 */
export async function toggleReadStatus(url, hasBeenRead) {
    await api.updateReadingListEntry({ url, hasBeenRead });
}

/**
 * Deletes a reading list entry.
 * Also marks the URL as fetched to prevent RSS from re-adding it.
 * @param {string} url - The URL of the entry to delete.
 */
export async function deleteEntry(url) {
    await api.removeReadingListEntry({ url });
    // Mark as fetched to prevent RSS from re-adding this URL
    await markAsFetched(url);
}

/**
 * Adds a URL to the reading list.
 * @param {string} url - The URL to add.
 * @param {string} title - The title of the entry.
 * @returns {Promise<void>}
 */
export async function addToReadingList(url, title) {
    await api.addReadingListEntry({ url, title, hasBeenRead: false });
}

/**
 * Gets all reading list entries.
 * @returns {Promise<Array>} Array of reading list entries.
 */
export async function getAllEntries() {
    return await api.queryReadingList();
}

/**
 * Checks if a URL already exists in the reading list.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>} True if the URL exists in the reading list.
 */
export async function isUrlInReadingList(url) {
    const entries = await api.queryReadingList({ url });
    return entries.length > 0;
}

/**
 * Gets unread entries only.
 * @returns {Promise<Array>} Array of unread reading list entries.
 */
export async function getUnreadEntries() {
    return await api.queryReadingList({ hasBeenRead: false });
}

/**
 * Gets read entries only.
 * @returns {Promise<Array>} Array of read reading list entries.
 */
export async function getReadEntries() {
    return await api.queryReadingList({ hasBeenRead: true });
}

/**
 * Calculates the number of days since an item was last updated (viewed).
 * @param {number} lastUpdateTime - The timestamp of the last update (ms since epoch).
 * @returns {number} Number of days since last update.
 */
export function getDaysSinceViewed(lastUpdateTime) {
    const now = Date.now();
    const diffMs = now - lastUpdateTime;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if an item should show the "viewed X days ago" label.
 * Only shows for items that have been read and are older than 3 days.
 * @param {Object} entry - The reading list entry.
 * @returns {boolean} Whether to show the label.
 */
export function shouldShowViewedLabel(entry) {
    if (!entry.hasBeenRead) return false;
    const daysSinceViewed = getDaysSinceViewed(entry.lastUpdateTime);
    return daysSinceViewed >= 1;
}

/**
 * Deletes all read entries from the reading list.
 * Also marks each URL as fetched to prevent RSS from re-adding them.
 * @returns {Promise<number>} Number of deleted entries.
 */
export async function deleteAllRead() {
    const readEntries = await getReadEntries();
    let deletedCount = 0;

    for (const entry of readEntries) {
        try {
            await api.removeReadingListEntry({ url: entry.url });
            // Mark as fetched to prevent RSS from re-adding
            await markAsFetched(entry.url);
            deletedCount++;
        } catch (err) {
            console.warn('Failed to delete entry:', entry.url, err);
        }
    }

    return deletedCount;
}
