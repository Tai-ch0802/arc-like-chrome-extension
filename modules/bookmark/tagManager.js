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

/**
 * 正規化 tag 名稱:trim、截 40 字,並剝除雙引號 —— tag 名含 `"` 會讓
 * dot-click 產生的 `tag:"..."` token 無法 round-trip(ISSUE-162 B4)。
 * 純函式(可單元測試)。
 * @param {unknown} name
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizeTagName(name, fallback = 'Tag') {
    const n = String(name ?? '').replace(/"/g, '').trim().slice(0, 40);
    return n || fallback;
}

let storageSubscribed = false;

export async function initTags() {
    const result = await getStorage('local', [TAGS_KEY, BOOKMARK_TAGS_KEY]);
    tags = result[TAGS_KEY] || {};
    bookmarkTags = result[BOOKMARK_TAGS_KEY] || {};

    // 跨視窗一致性(ISSUE-162 B1):tags/bookmarkTags 是整表持久化的
    // 可變資料集,且本擴充功能支援多個同時開啟的 sidepanel。沒有這個
    // 訂閱,視窗 B 會拿陳舊的 in-memory 表覆寫掉視窗 A 剛建立的 tag
    // (last-write-wins 互滅)。寫入端自己的 onChanged 會因內容相同而
    // 跳過重繪(免雙重 render)。
    if (!storageSubscribed && typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        storageSubscribed = true;
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (!changes[TAGS_KEY] && !changes[BOOKMARK_TAGS_KEY]) return;
            let dirty = false;
            if (changes[TAGS_KEY]) {
                const next = changes[TAGS_KEY].newValue || {};
                if (JSON.stringify(next) !== JSON.stringify(tags)) {
                    tags = next;
                    dirty = true;
                }
            }
            if (changes[BOOKMARK_TAGS_KEY]) {
                const next = changes[BOOKMARK_TAGS_KEY].newValue || {};
                if (JSON.stringify(next) !== JSON.stringify(bookmarkTags)) {
                    bookmarkTags = next;
                    dirty = true;
                }
            }
            // 重繪書籤列讓 tag dots 反映他窗變更;spotlight 等無此監聽的
            // context 只更新 in-memory 即可。
            if (dirty && typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('refreshBookmarksRequired'));
            }
        });
    }
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
        name: normalizeTagName(args.name),
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
    if (updates.name !== undefined) tag.name = normalizeTagName(updates.name, tag.name);
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
