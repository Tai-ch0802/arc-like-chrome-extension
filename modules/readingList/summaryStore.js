/**
 * Reading List Summary Store
 *
 * Persists per-URL AI summaries so they're available even when the user is
 * offline or the original page is no longer reachable. Stored in
 * chrome.storage.local keyed by URL (Reading List entries are URL-keyed
 * upstream too).
 *
 * Storage shape:
 *   chrome.storage.local.readingListSummaries: {
 *     [url]: { summary, createdAt }
 *   }
 */
import { getStorage, setStorage } from '../apiManager.js';

const STORAGE_KEY = 'readingListSummaries';

/** @type {Object<string, {summary: string, createdAt: number}>} */
let summaries = {};

export async function initSummaries() {
    const result = await getStorage('local', [STORAGE_KEY]);
    summaries = result[STORAGE_KEY] || {};
}

export function getSummary(url) {
    return summaries[url] || null;
}

export function hasSummary(url) {
    return Boolean(summaries[url]);
}

export async function setSummary(url, summary) {
    if (!url || !summary) return;
    summaries[url] = { summary, createdAt: Date.now() };
    await persist();
}

export async function deleteSummary(url) {
    if (!(url in summaries)) return;
    delete summaries[url];
    await persist();
}

/**
 * Remove summaries whose URL no longer appears in the live Reading List.
 *
 * Guards against an empty list (cold start, fetch failure) silently wiping
 * every stored summary — same lesson as PR #143's pruneOrphanedBookmarkTags.
 * Caller passes the live URL set; we never call chrome.readingList ourselves
 * so this stays a pure function.
 *
 * @param {string[]} liveUrls
 */
export async function pruneOrphans(liveUrls) {
    if (!Array.isArray(liveUrls) || liveUrls.length === 0) return;
    const alive = new Set(liveUrls);
    let changed = false;
    for (const url of Object.keys(summaries)) {
        if (!alive.has(url)) {
            delete summaries[url];
            changed = true;
        }
    }
    if (changed) await persist();
}

/**
 * Cross-sidepanel sync. When another sidepanel writes a new summary, our
 * in-memory mirror would otherwise stay stale until the next page load.
 *
 * @param {() => void} [onChange]
 */
export function subscribeToChanges(onChange) {
    if (!chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[STORAGE_KEY]) {
            summaries = changes[STORAGE_KEY].newValue || {};
            try { onChange?.(); } catch (err) {
                console.warn('[rlSummary] sync callback failed:', err);
            }
        }
    });
}

function persist() {
    return setStorage('local', { [STORAGE_KEY]: summaries });
}
