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
