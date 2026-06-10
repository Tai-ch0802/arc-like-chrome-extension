/**
 * Bookmark Tag Manager
 *
 * Lets users tag bookmarks beyond Chrome's single-folder hierarchy. A bookmark
 * can have many tags; a tag has many bookmarks. We keep the data in
 * chrome.storage.local since Chrome doesn't expose a per-bookmark metadata API.
 *
 * Storage layout:
 *   chrome.storage.local.tags          → { [tagId]: { id, name, color, createdAt } }
 *   chrome.storage.local.bookmarkTags  → { [bookmarkId]: [tagId, ...] }
 *
 * Bookmarks deleted from Chrome leave orphan entries in bookmarkTags; we prune
 * them lazily via pruneOrphanedBookmarkTags() (called from init).
 */
import { getStorage, setStorage } from '../apiManager.js';

const TAGS_KEY = 'tags';
const BOOKMARK_TAGS_KEY = 'bookmarkTags';

const PRESET_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

/** @type {Object<string, {id: string, name: string, color: string, createdAt: number}>} */
let tags = {};
/** @type {Object<string, string[]>} */
let bookmarkTags = {};

export async function initTags() {
    const result = await getStorage('local', [TAGS_KEY, BOOKMARK_TAGS_KEY]);
    tags = result[TAGS_KEY] || {};
    bookmarkTags = result[BOOKMARK_TAGS_KEY] || {};
}

export function getAllTags() {
    return Object.values(tags).sort((a, b) => a.name.localeCompare(b.name));
}

export function getTag(id) {
    return tags[id] || null;
}

export function getTagsForBookmark(bookmarkId) {
    const ids = bookmarkTags[String(bookmarkId)] || [];
    return ids.map(id => tags[id]).filter(Boolean);
}

export function getBookmarkIdsForTag(tagId) {
    const ids = [];
    for (const [bid, tagIds] of Object.entries(bookmarkTags)) {
        if (tagIds.includes(tagId)) ids.push(bid);
    }
    return ids;
}

export function getPresetColors() {
    return [...PRESET_COLORS];
}

/**
 * 以名稱(不分大小寫)尋找既有 tag。建立入口用來防重複(ISSUE-162 WP6):
 * tag: 查詢按小寫名稱比對,Work/work 並存時查詢無法區分、dots 卻兩顆。
 * @param {string} name
 * @returns {object|null}
 */
export function findTagByName(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return Object.values(tags).find(t => t.name.toLowerCase() === n) || null;
}

/**
 * @param {{name: string, color?: string}} args
 * @returns {Promise<object>}
 */
export async function createTag(args) {
    const id = 'tag_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const tag = {
        id,
        name: (args.name || 'Tag').trim().slice(0, 40),
        color: PRESET_COLORS.includes(args.color) ? args.color : 'blue',
        createdAt: Date.now(),
    };
    tags[id] = tag;
    await persistTags();
    return tag;
}

export async function updateTag(id, updates) {
    const tag = tags[id];
    if (!tag) return null;
    if (updates.name !== undefined) tag.name = updates.name.trim().slice(0, 40);
    if (updates.color !== undefined && PRESET_COLORS.includes(updates.color)) tag.color = updates.color;
    await persistTags();
    return tag;
}

/**
 * Deletes the tag and unbinds it from every bookmark. Cleans up empty arrays.
 */
export async function deleteTag(id) {
    delete tags[id];
    for (const bid of Object.keys(bookmarkTags)) {
        bookmarkTags[bid] = bookmarkTags[bid].filter(t => t !== id);
        if (bookmarkTags[bid].length === 0) delete bookmarkTags[bid];
    }
    await Promise.all([persistTags(), persistBookmarkTags()]);
}

export async function addTagToBookmark(bookmarkId, tagId) {
    if (!tags[tagId]) return false;
    const key = String(bookmarkId);
    const list = bookmarkTags[key] || [];
    if (!list.includes(tagId)) {
        list.push(tagId);
        bookmarkTags[key] = list;
        await persistBookmarkTags();
    }
    return true;
}

export async function removeTagFromBookmark(bookmarkId, tagId) {
    const key = String(bookmarkId);
    if (!bookmarkTags[key]) return false;
    bookmarkTags[key] = bookmarkTags[key].filter(t => t !== tagId);
    if (bookmarkTags[key].length === 0) delete bookmarkTags[key];
    await persistBookmarkTags();
    return true;
}

/**
 * Removes bookmarkTags entries whose bookmark no longer exists.
 * Caller passes the current bookmark cache (already flat) to avoid a second
 * traversal of chrome.bookmarks.getTree.
 *
 * @param {Array<{id: string, type: string}>} flatBookmarkCache
 */
export async function pruneOrphanedBookmarkTags(flatBookmarkCache) {
    // Empty cache could mean storage failure or cold start, not that the user
    // really has zero bookmarks. Pruning here would silently delete every
    // tag binding with no undo. Skip — next prune runs after a real cache.
    if (!Array.isArray(flatBookmarkCache) || flatBookmarkCache.length === 0) return;

    const alive = new Set(flatBookmarkCache.map(b => String(b.id)));
    let changed = false;
    for (const bid of Object.keys(bookmarkTags)) {
        if (!alive.has(bid)) {
            delete bookmarkTags[bid];
            changed = true;
        }
    }
    if (changed) await persistBookmarkTags();
}

function persistTags() {
    return setStorage('local', { [TAGS_KEY]: tags });
}

function persistBookmarkTags() {
    return setStorage('local', { [BOOKMARK_TAGS_KEY]: bookmarkTags });
}
