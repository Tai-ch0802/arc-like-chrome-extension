/**
 * Dead-link Checker
 *
 * Pings every http(s) bookmark with HEAD + mode:'no-cors' and reports which
 * URLs the network couldn't reach. Runs in the sidepanel directly (not the
 * offscreen document) because:
 *   - fetch is available here and manifest host_permissions ("*://*\/*") let
 *     us hit any URL
 *   - the scan is user-initiated and consumed by live sidepanel UI, so an
 *     offscreen round-trip adds latency with no benefit
 *   - sidepanel won't be torn down mid-scan the way a service worker can be
 *
 * Limitation we own intentionally: in no-cors mode the response is opaque,
 * so we can NOT distinguish 200 from 4xx/5xx. "Unreachable" here means
 * "fetch threw" — DNS fail, connection refused, certificate error, etc.
 * That's still the most common signal for true dead links; HTTP-level
 * status checks would require per-origin CORS which we cannot demand.
 */

const REQUEST_TIMEOUT_MS = 8000;
const CONCURRENT = 6;

/**
 * @typedef {Object} LinkCheckResult
 * @property {string} bookmarkId
 * @property {string} url
 * @property {string} title
 * @property {'unreachable'|'reachable'|'skipped'} status
 * @property {string} [error]
 */

/**
 * @param {Array<{id: string, url: string, title: string}>} bookmarks
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<LinkCheckResult[] | {offline: true}>}
 *   Returns {offline: true} if navigator.onLine reports offline, so callers
 *   can refuse to render "unreachable" results that would otherwise flag the
 *   entire bookmark library as deletable due to a transient network drop.
 */
export async function scanDeadLinks(bookmarks, onProgress) {
    // Offline pre-check: without this, a Wi-Fi blip during the scan would mark
    // every http(s) bookmark as "unreachable" and (with the old default-checked
    // UI) one click would delete the whole library.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { offline: true };
    }

    const targets = bookmarks.filter(b => /^https?:/i.test(b.url));
    const skipped = bookmarks
        .filter(b => !/^https?:/i.test(b.url))
        .map(b => ({ bookmarkId: b.id, url: b.url, title: b.title, status: 'skipped' }));

    const results = [];
    let done = 0;
    let cursor = 0;
    const total = targets.length;

    const worker = async () => {
        while (cursor < targets.length) {
            const i = cursor++;
            const b = targets[i];
            const result = await checkOne(b);
            results.push(result);
            done++;
            try { onProgress?.(done, total); } catch { /* progress UI is best-effort */ }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENT }, worker));
    return [...results, ...skipped];
}

async function checkOne(b) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        await fetch(b.url, {
            method: 'HEAD',
            mode: 'no-cors',
            credentials: 'omit',
            redirect: 'follow',
            signal: controller.signal,
            cache: 'no-store',
        });
        clearTimeout(timer);
        return { bookmarkId: b.id, url: b.url, title: b.title, status: 'reachable' };
    } catch (err) {
        clearTimeout(timer);
        return {
            bookmarkId: b.id,
            url: b.url,
            title: b.title,
            status: 'unreachable',
            error: err.name === 'AbortError' ? 'timeout' : (err.message || 'fetch failed'),
        };
    }
}
