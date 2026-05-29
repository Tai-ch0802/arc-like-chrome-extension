/**
 * Shared bookmark utilities used by dedupe and dead-link cleanup.
 * Extracted so the dead-link path doesn't reach across modules into dedupe
 * for an unrelated concern.
 */

/**
 * Sequentially removes a list of bookmark IDs. Per-item failures are logged
 * but don't abort the batch — partial success is usually preferable to
 * "all-or-nothing" for bulk cleanup.
 *
 * @param {string[]} bookmarkIds
 * @returns {Promise<number>} count successfully removed
 */
export async function bulkRemove(bookmarkIds) {
    let removed = 0;
    for (const id of bookmarkIds) {
        try {
            await chrome.bookmarks.remove(id);
            removed++;
        } catch (err) {
            console.warn('[bookmarkUtils] failed to remove', id, err);
        }
    }
    return removed;
}

/**
 * 從扁平書籤快取中，取出指定資料夾子樹（含巢狀子資料夾）下的所有書籤。
 * @param {Array<{id:string,type:string,parentId:string}>} cache 扁平快取
 * @param {string|null|undefined} folderId 省略/falsy 時回傳全部書籤
 * @returns {Array} 僅 type==='bookmark' 的項目
 */
export function filterBookmarksUnderFolder(cache, folderId) {
    if (!Array.isArray(cache)) return [];
    if (!folderId) return cache.filter(i => i.type === 'bookmark');

    const childrenByParent = new Map();
    for (const item of cache) {
        const p = String(item.parentId ?? '');
        if (!childrenByParent.has(p)) childrenByParent.set(p, []);
        childrenByParent.get(p).push(item);
    }

    const result = [];
    const seen = new Set();
    const stack = [String(folderId)];
    while (stack.length) {
        const pid = stack.pop();
        if (seen.has(pid)) continue; // 防禦環狀
        seen.add(pid);
        for (const child of (childrenByParent.get(pid) || [])) {
            if (child.type === 'bookmark') result.push(child);
            else stack.push(String(child.id)); // 子資料夾 → 繼續往下
        }
    }
    return result;
}
