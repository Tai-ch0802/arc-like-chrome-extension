/**
 * Bookmark Deduplication Scanner
 *
 * Walks the flat bookmark cache (state.getBookmarkCache()) and returns groups
 * of bookmarks sharing the same normalized URL. The renderer (bookmarkToolsUI)
 * lets the user pick which copy to keep per group.
 *
 * Normalization is intentionally light: lowercase host, trim trailing slash,
 * strip URL fragments. We do NOT strip query strings — many sites encode
 * meaningful state there (e.g. /watch?v=...), and aggressive normalization
 * would falsely merge distinct bookmarks.
 */

import * as state from '../stateManager.js';

/**
 * @typedef {Object} DuplicateGroup
 * @property {string} normalizedUrl
 * @property {Array<{id: string, title: string, url: string, parentId: string, path: string[]}>} bookmarks
 */

/**
 * @returns {DuplicateGroup[]} Groups with 2+ bookmarks each, sorted by group size desc.
 */
export function findDuplicates() {
    const cache = state.getBookmarkCache() || [];
    const groups = new Map();
    for (const item of cache) {
        if (item.type !== 'bookmark') continue;
        const key = normalizeUrl(item.url);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({
            id: String(item.id),
            title: item.title || '',
            url: item.url,
            parentId: String(item.parentId || ''),
            path: item.path || [],
        });
    }
    const result = [];
    for (const [normalizedUrl, bookmarks] of groups.entries()) {
        if (bookmarks.length >= 2) {
            result.push({ normalizedUrl, bookmarks });
        }
    }
    result.sort((a, b) => b.bookmarks.length - a.bookmarks.length);
    return result;
}

/**
 * Bulk-delete the given bookmark ids via chrome.bookmarks.remove.
 * Returns the count successfully removed.
 */
export async function bulkRemove(bookmarkIds) {
    let removed = 0;
    for (const id of bookmarkIds) {
        try {
            await chrome.bookmarks.remove(id);
            removed++;
        } catch (err) {
            console.warn('[dedupe] failed to remove', id, err);
        }
    }
    return removed;
}

function normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
        const u = new URL(rawUrl);
        // Strip fragment, lowercase host, drop trailing slash on path
        let path = u.pathname;
        if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
        return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}`;
    } catch {
        return rawUrl.trim();
    }
}
