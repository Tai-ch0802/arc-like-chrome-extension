// --- RSS Manager Module ---
// Manages RSS subscription storage, scheduling, and fetching

import * as api from './apiManager.js';
import { addToReadingList } from './readingListManager.js';
import { MAX_STORED_HASHES, mergeHashesForWrite, nextTimestamp } from './rss/rssSyncLogic.js';
import { ensureOffscreenDocument } from './offscreenManager.js';

// --- Constants ---
const RSS_SUBSCRIPTIONS_KEY = 'rssSubscriptions';
const RSS_FETCHED_HASHES_KEY = 'rssFetchedHashes';
const RSS_FETCH_FAILURES_KEY = 'rssFetchFailures';
// Tombstones for deleted subscriptions ({id: deletedAtMs}), so a deletion
// propagates through the Drive union-merge instead of the sibling resurrecting
// it. chrome.storage.local (device working copy; Drive is the sync layer).
const RSS_TOMBSTONES_KEY = 'rssTombstones';
// One-time flag: subscriptions were seeded from the legacy storage.sync location
// into storage.local. Ensures we never re-seed from a stale sync copy.
const RSS_MIGRATED_KEY = 'rssMigratedFromSync';
// MAX_STORED_HASHES now lives in rssSyncLogic (raised 500 -> 5000 so the
// cross-device hash union never tops out in steady state, which would break the
// merge's idempotency; see rssSyncLogic.js).
const MAX_FAILURE_LOG = 20; // Ring buffer for surfacing recent fetch failures to UI
const DELIMITER = '|';
const ESCAPE_CHAR = '\\|';
const ALARM_PREFIX = 'rss_fetch_';
const FETCH_TIMEOUT_MS = 10000; // 10 seconds

// --- In-memory cache ---
let subscriptions = [];
let fetchedHashes = new Set();

// --- Serialization/Deserialization ---

/**
 * Escapes pipe characters in a string for storage.
 * @param {string} str - String to escape.
 * @returns {string} Escaped string.
 */
function escapeDelimiter(str) {
    return str.replace(/\\/g, '\\\\').replace(/\|/g, ESCAPE_CHAR);
}

/**
 * Unescapes pipe characters in a string.
 * @param {string} str - String to unescape.
 * @returns {string} Unescaped string.
 */
function unescapeDelimiter(str) {
    return str.replace(/\\\|/g, '|').replace(/\\\\/g, '\\');
}

/**
 * Serializes a subscription object to pipe-delimited string.
 * @param {RssSubscription} sub - Subscription object.
 * @returns {string} Serialized string.
 */
function serializeSubscription(sub) {
    return [
        sub.id,
        escapeDelimiter(sub.url),
        escapeDelimiter(sub.title),
        sub.interval,
        sub.enabled ? '1' : '0',
        sub.lastFetched,
        // updatedAt: monotonic edit timestamp — the cross-device conflict key.
        sub.updatedAt || 0
    ].join(DELIMITER);
}

/**
 * Parses a pipe-delimited string to subscription object.
 * @param {string} str - Serialized string.
 * @returns {RssSubscription} Subscription object.
 */
function parseSubscription(str) {
    // Split on unescaped | (use simple split and handle edge cases)
    const parts = str.split(/(?<!\\)\|/);
    return {
        id: parts[0],
        url: unescapeDelimiter(parts[1] || ''),
        title: unescapeDelimiter(parts[2] || ''),
        interval: parts[3] || '24h',
        enabled: parts[4] === '1',
        lastFetched: parseInt(parts[5], 10) || 0,
        // Missing on legacy (6-field) records seeded from storage.sync -> 0, so
        // any real edit or Drive tombstone from another device wins the merge.
        updatedAt: parseInt(parts[6], 10) || 0
    };
}

/**
 * Generates a unique subscription ID.
 * @returns {string} Unique ID.
 */
function generateId() {
    return 'rss_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Converts interval string to minutes.
 * @param {string} interval - Interval string (e.g., '1h', '24h').
 * @returns {number} Minutes.
 */
function intervalToMinutes(interval) {
    const map = {
        '1h': 60,
        '3h': 180,
        '8h': 480,
        '12h': 720,
        '24h': 1440
    };
    return map[interval] || 1440;
}

// --- Storage Operations ---

/**
 * One-time migration: seed the storage.local subscription working copy from the
 * legacy storage.sync location. Idempotent (flag-guarded), seeds at most once
 * per install, and only when local is empty.
 *
 * Why local-first with a permanent flag: Drive is now the single cross-device
 * source of truth (via the union-merge). If we re-seeded from storage.sync every
 * time local was empty, a device that later cleared local (reinstall, eviction)
 * would resurrect subscriptions the user deleted on another device once the
 * Drive tombstone had been GC'd. Seeded records carry no updatedAt (parse -> 0),
 * so any real edit or live tombstone deterministically overrides them.
 *
 * We deliberately do NOT delete the storage.sync key: its removal would
 * propagate through Chrome's native sync and wipe subscriptions on any device
 * still running the pre-migration version.
 */
async function migrateSubsFromSyncIfNeeded() {
    const flags = await api.getStorage('local', [RSS_MIGRATED_KEY]);
    if (flags[RSS_MIGRATED_KEY]) return;

    const localRes = await api.getStorage('local', [RSS_SUBSCRIPTIONS_KEY]);
    const localSubs = localRes[RSS_SUBSCRIPTIONS_KEY];
    const hasLocal = Array.isArray(localSubs) && localSubs.length > 0;
    if (!hasLocal) {
        const syncRes = await api.getStorage('sync', [RSS_SUBSCRIPTIONS_KEY]);
        const syncSubs = syncRes[RSS_SUBSCRIPTIONS_KEY];
        if (Array.isArray(syncSubs) && syncSubs.length > 0) {
            await api.setStorage('local', { [RSS_SUBSCRIPTIONS_KEY]: syncSubs });
        }
    }
    await api.setStorage('local', { [RSS_MIGRATED_KEY]: true });
}

/**
 * Loads subscriptions from storage into memory.
 */
async function loadSubscriptions() {
    await migrateSubsFromSyncIfNeeded();
    const result = await api.getStorage('local', [RSS_SUBSCRIPTIONS_KEY]);
    const stored = result[RSS_SUBSCRIPTIONS_KEY] || [];
    subscriptions = stored.map(parseSubscription);
}

/**
 * Saves the WHOLE subscription array to storage.local. This is the authoritative
 * whole-array write used by the user-facing editors (add/remove/update, all
 * running in the options page — the single authoritative editor). The Service
 * Worker must NOT use this to update lastFetched; see persistLastFetched.
 */
async function saveSubscriptions() {
    const serialized = subscriptions.map(serializeSubscription);
    await api.setStorage('local', { [RSS_SUBSCRIPTIONS_KEY]: serialized });
}

// Serialises field-level lastFetched writes from the SW's fetch loop. Reading
// the CURRENT stored array and touching only one field (instead of dumping the
// SW's whole in-memory array) stops the fetch loop from clobbering a concurrent
// interval/enable edit made in the options page. Mirrors failureLogChain.
let subsWriteChain = Promise.resolve();

/**
 * Persists ONE subscription's lastFetched without overwriting other fields.
 * @param {string} id
 * @param {number} ts
 * @returns {Promise<void>}
 */
function persistLastFetched(id, ts) {
    subsWriteChain = subsWriteChain.then(async () => {
        try {
            const res = await api.getStorage('local', [RSS_SUBSCRIPTIONS_KEY]);
            const stored = (res[RSS_SUBSCRIPTIONS_KEY] || []).map(parseSubscription);
            const target = stored.find((s) => s.id === id);
            if (!target) return;
            target.lastFetched = ts;
            await api.setStorage('local', { [RSS_SUBSCRIPTIONS_KEY]: stored.map(serializeSubscription) });
            const mem = subscriptions.find((s) => s.id === id);
            if (mem) mem.lastFetched = ts;
        } catch (e) {
            console.warn('RSS: persistLastFetched failed', e);
        }
    });
    return subsWriteChain;
}

/**
 * Writes a tombstone for a deleted subscription so the deletion propagates
 * through the Drive union-merge. deletedAt is forced strictly newer than the
 * sub's own updatedAt so the merge reliably hides it.
 * @param {string} id
 * @param {object|undefined} removed - the subscription object being removed.
 */
async function writeTombstone(id, removed) {
    const res = await api.getStorage('local', [RSS_TOMBSTONES_KEY]);
    const tombs = res[RSS_TOMBSTONES_KEY] || {};
    tombs[id] = nextTimestamp(removed && removed.updatedAt, Date.now());
    await api.setStorage('local', { [RSS_TOMBSTONES_KEY]: tombs });
}

// --- Hash Storage Operations (Local) ---

/**
 * Loads fetched hashes from local storage.
 */
async function loadFetchedHashes() {
    const result = await api.getStorage('local', [RSS_FETCHED_HASHES_KEY]);
    const stored = result[RSS_FETCHED_HASHES_KEY] || [];
    fetchedHashes = new Set(stored);
}

// Serialises hash writes AND makes them read-merge-write instead of blind
// overwrite. This is the root-cause fix for the duplicate-items bug: each JS
// context (SW / side panel / options) held its own module-level `fetchedHashes`
// Set and blindly wrote Array.from(it), so a stale snapshot in a long-lived
// panel would delete hashes the SW had just persisted, and the next SW cold
// reload would treat those articles as new. Re-reading storage and writing the
// UNION means a write can only ADD, never delete another context's hashes.
let hashWriteChain = Promise.resolve();

/**
 * Saves fetched hashes to local storage as the UNION of what is already there
 * and the in-memory Set, capped to MAX_STORED_HASHES. Serialised via
 * hashWriteChain so concurrent saves cannot lose entries.
 * // ponytail: FIFO array + high cap; if dozens of high-frequency feeds ever
 * // blow the cap, switch to {hash: lastSeenMs} evict-oldest (deterministic).
 */
async function saveFetchedHashes() {
    hashWriteChain = hashWriteChain.then(async () => {
        try {
            const result = await api.getStorage('local', [RSS_FETCHED_HASHES_KEY]);
            const stored = result[RSS_FETCHED_HASHES_KEY] || [];
            const merged = mergeHashesForWrite(stored, fetchedHashes, MAX_STORED_HASHES);
            fetchedHashes = new Set(merged);
            await api.setStorage('local', { [RSS_FETCHED_HASHES_KEY]: merged });
        } catch (e) {
            console.warn('RSS: saveFetchedHashes failed', e);
        }
    });
    return hashWriteChain;
}

/**
 * Calculates SHA-256 hash of a URL string.
 * @param {string} url - URL to hash.
 * @returns {Promise<string>} Hex-encoded hash.
 */
async function calculateHash(url) {
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if a URL hash has been fetched before.
 * @param {string} url - URL to check.
 * @returns {Promise<boolean>} True if already fetched.
 */
async function isHashFetched(url) {
    const hash = await calculateHash(url);
    return fetchedHashes.has(hash);
}

// Serialises concurrent recordFetchFailure() calls. Without this, simultaneous
// alarm failures could read the same baseline log, then overwrite each other on
// write — losing entries. The chain stays fulfilled because the inner try/catch
// never lets rejections propagate.
let failureLogChain = Promise.resolve();

/**
 * Records a fetch failure to chrome.storage.local as a ring buffer.
 * Serialised — concurrent calls run sequentially via failureLogChain.
 * Surfaces silent alarm failures to settings UI; does not retry automatically.
 * @param {string} subscriptionId
 * @param {string} feedUrl
 * @param {Error|string} error
 * @returns {Promise<void>} Resolves once this entry's write completes.
 */
function recordFetchFailure(subscriptionId, feedUrl, error) {
    failureLogChain = failureLogChain.then(async () => {
        try {
            const existing = await api.getStorage('local', [RSS_FETCH_FAILURES_KEY]);
            const log = existing[RSS_FETCH_FAILURES_KEY] || [];
            log.push({
                subscriptionId,
                feedUrl,
                errorMessage: error && error.message ? error.message : String(error),
                timestamp: Date.now()
            });
            const trimmed = log.length > MAX_FAILURE_LOG ? log.slice(-MAX_FAILURE_LOG) : log;
            await api.setStorage('local', { [RSS_FETCH_FAILURES_KEY]: trimmed });
        } catch (e) {
            console.warn('RSS: failed to record fetch failure log', e);
        }
    });
    return failureLogChain;
}

/**
 * Returns recent fetch failures, newest last. Intended for settings UI.
 * @returns {Promise<Array<{subscriptionId: string, feedUrl: string, errorMessage: string, timestamp: number}>>}
 */
export async function getRecentFetchFailures() {
    const result = await api.getStorage('local', [RSS_FETCH_FAILURES_KEY]);
    return result[RSS_FETCH_FAILURES_KEY] || [];
}

/**
 * Clears the recorded fetch failure log. Intended for settings UI.
 */
export async function clearFetchFailures() {
    await api.setStorage('local', { [RSS_FETCH_FAILURES_KEY]: [] });
}

/**
 * Marks a URL as fetched by adding its hash.
 * Also saves to storage immediately to persist the change.
 * @param {string} url - URL to mark.
 */
export async function markAsFetched(url) {
    const hash = await calculateHash(url);
    fetchedHashes.add(hash);
    await saveFetchedHashes();
}

// --- Cross-context cache freshness ---

// Keep this context's in-memory caches fresh when ANOTHER context (or the Drive
// sync write-back in the SW) mutates local storage. Without this the second half
// of the duplicate bug remained: isHashFetched would miss hashes a sibling
// context added, and the subscription list would go stale. Registered once at
// module load — in the SW this runs synchronously at top-level import, so the
// listener survives SW restarts (MV3 requirement). Alarms are intentionally NOT
// re-derived here; they are managed at the explicit mutation points
// (add/remove/update) and by importMergedRssState in the SW.
let storageListenerRegistered = false;
function registerRssStorageListener() {
    if (storageListenerRegistered) return;
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return;
    storageListenerRegistered = true;
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[RSS_FETCHED_HASHES_KEY]) {
            // Union (monotonic) rather than replace, so an in-flight local add
            // that hasn't been flushed yet is never dropped.
            const stored = changes[RSS_FETCHED_HASHES_KEY].newValue || [];
            for (const h of stored) fetchedHashes.add(h);
        }
        if (changes[RSS_SUBSCRIPTIONS_KEY]) {
            const stored = changes[RSS_SUBSCRIPTIONS_KEY].newValue || [];
            subscriptions = stored.map(parseSubscription);
        }
    });
}
registerRssStorageListener();

// --- Drive sync bridge (rssManager stays Drive-agnostic; background.js drives) ---

/**
 * Snapshot the local RSS working copy (fresh from storage.local, not the
 * possibly-stale in-memory cache) in the shape rssSyncLogic.mergeRssState wants.
 * @returns {Promise<{subscriptions: object[], hashes: string[], tombstones: Object<string,number>}>}
 */
export async function exportLocalRssState() {
    const res = await api.getStorage('local', [
        RSS_SUBSCRIPTIONS_KEY, RSS_FETCHED_HASHES_KEY, RSS_TOMBSTONES_KEY,
    ]);
    return {
        subscriptions: (res[RSS_SUBSCRIPTIONS_KEY] || []).map(parseSubscription),
        hashes: res[RSS_FETCHED_HASHES_KEY] || [],
        tombstones: res[RSS_TOMBSTONES_KEY] || {},
    };
}

/**
 * Write a merged RSS state back into storage.local and reconcile alarms. Called
 * only by the SW after mergeRssState. Subscriptions are a whole replace (the
 * merged set already incorporates the local copy); hashes go through the union
 * write-chain so a concurrent markAsFetched is not lost.
 * @param {{subscriptions: object[], hashes: string[], tombstones: Object<string,number>}} merged
 */
export async function importMergedRssState(merged) {
    // Read the authoritative PREVIOUS stored subscriptions (not the in-memory
    // cache, which may be empty on a cold SW) so alarm reconciliation only
    // touches genuine deltas.
    const prevRes = await api.getStorage('local', [RSS_SUBSCRIPTIONS_KEY]);
    const prevById = new Map(
        (prevRes[RSS_SUBSCRIPTIONS_KEY] || []).map(parseSubscription).map((s) => [s.id, s]),
    );

    subscriptions = (merged.subscriptions || []).map((s) => ({
        id: s.id,
        url: s.url,
        title: s.title,
        interval: s.interval || '24h',
        enabled: !!s.enabled,
        lastFetched: s.lastFetched || 0,
        updatedAt: s.updatedAt || 0,
    }));
    await api.setStorage('local', {
        [RSS_SUBSCRIPTIONS_KEY]: subscriptions.map(serializeSubscription),
        [RSS_TOMBSTONES_KEY]: merged.tombstones || {},
    });
    for (const h of (merged.hashes || [])) fetchedHashes.add(h);
    await saveFetchedHashes();

    // Reconcile alarms by DELTA only. Recreating every alarm would reset each to
    // delayInMinutes:1 on every import — two devices subscribed to the same feed
    // would then ping-pong fetching ~every minute. A sub whose only change is
    // lastFetched/updatedAt/title keeps its existing schedule untouched.
    const nextById = new Map(subscriptions.map((s) => [s.id, s]));
    for (const id of prevById.keys()) {
        if (!nextById.has(id)) await clearAlarm(id);
    }
    for (const [id, sub] of nextById) {
        const prev = prevById.get(id);
        const materiallyChanged = !prev || prev.enabled !== sub.enabled || prev.interval !== sub.interval;
        if (!materiallyChanged) continue;
        await clearAlarm(id);
        if (sub.enabled) await setupAlarm(sub);
    }
}

// --- Alarm Management ---

/**
 * Sets up an alarm for a subscription.
 * @param {RssSubscription} sub - Subscription object.
 */
async function setupAlarm(sub) {
    if (!sub.enabled) return;

    const alarmName = ALARM_PREFIX + sub.id;
    const periodInMinutes = intervalToMinutes(sub.interval);

    await chrome.alarms.create(alarmName, {
        periodInMinutes,
        delayInMinutes: 1 // Start first fetch after 1 minute
    });
}

/**
 * Clears an alarm for a subscription.
 * @param {string} subscriptionId - Subscription ID.
 */
async function clearAlarm(subscriptionId) {
    const alarmName = ALARM_PREFIX + subscriptionId;
    await chrome.alarms.clear(alarmName);
}

/**
 * Sets up alarms for all enabled subscriptions.
 */
async function setupAllAlarms() {
    // Clear all existing RSS alarms first
    const alarms = await chrome.alarms.getAll();
    for (const alarm of alarms) {
        if (alarm.name.startsWith(ALARM_PREFIX)) {
            await chrome.alarms.clear(alarm.name);
        }
    }

    // Setup alarms for enabled subscriptions
    for (const sub of subscriptions) {
        if (sub.enabled) {
            await setupAlarm(sub);
        }
    }
}

// --- Local XML Parsing (for extension page contexts with DOMParser) ---

/**
 * Gets text content of a direct child element.
 * @param {Element} parent - Parent element.
 * @param {string} tagName - Tag name to find.
 * @returns {string|null}
 */
function getTextContent(parent, tagName) {
    const el = parent.querySelector(tagName);
    return el ? el.textContent : null;
}

/**
 * Gets the link href from an Atom entry.
 * Prioritizes rel="alternate" link.
 * @param {Element} entry - Atom entry element.
 * @returns {string|null}
 */
function getAtomLink(entry) {
    const alternateLink = entry.querySelector('link[rel="alternate"]');
    if (alternateLink && alternateLink.hasAttribute('href')) {
        return alternateLink.getAttribute('href');
    }
    const anyLink = entry.querySelector('link[href]');
    if (anyLink) {
        return anyLink.getAttribute('href');
    }
    const linkContent = entry.querySelector('link');
    if (linkContent && linkContent.textContent) {
        return linkContent.textContent.trim();
    }
    return null;
}

/**
 * Gets link from guid if isPermaLink is true.
 * @param {Element} item - RSS item element.
 * @returns {string|null}
 */
function getLinkFromGuid(item) {
    const guid = item.querySelector('guid');
    if (!guid) return null;
    const isPermaLink = guid.getAttribute('isPermaLink');
    const content = guid.textContent.trim();
    if (isPermaLink === 'true' ||
        (isPermaLink !== 'false' && (content.startsWith('http://') || content.startsWith('https://')))) {
        return content;
    }
    return null;
}

/**
 * Parses RSS/Atom XML string using DOMParser.
 * This is used in extension page contexts (side panel) where DOMParser is available.
 * @param {string} xmlText - Raw XML text.
 * @returns {{title: string, items: Array<{title: string, url: string}>}}
 */
function parseRssFeedXml(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('XML Parse Error: ' + parseError.textContent.slice(0, 100));
    }

    const feedElement = doc.querySelector('feed'); // Atom
    const channelElement = doc.querySelector('channel'); // RSS

    let feedTitle = '';
    let items = [];

    if (feedElement) {
        feedTitle = getTextContent(feedElement, 'title') || '';
        const entries = feedElement.querySelectorAll('entry');
        entries.forEach(entry => {
            const title = getTextContent(entry, 'title') || '';
            const url = getAtomLink(entry) || '';
            if (url) items.push({ title, url });
        });
    } else if (channelElement) {
        const channelTitleEl = channelElement.querySelector(':scope > title');
        feedTitle = channelTitleEl ? channelTitleEl.textContent.trim() : '';
        const rssItems = channelElement.querySelectorAll('item');
        rssItems.forEach(item => {
            const title = getTextContent(item, 'title') || '';
            const url = getTextContent(item, 'link') || getLinkFromGuid(item) || '';
            if (url) items.push({ title: title.trim(), url: url.trim() });
        });
    } else {
        throw new Error('Unknown feed format: neither RSS nor Atom detected');
    }

    return { title: feedTitle.trim(), items };
}

// --- Feed Fetching ---

/**
 * Fetches and parses an RSS feed with timeout.
 * 
 * Automatically detects the execution context:
 * - Extension pages (side panel): Fetches and parses locally using DOMParser.
 * - Service Worker (background): Delegates both fetch and parse to the offscreen document.
 * 
 * @param {string} feedUrl - RSS feed URL.
 * @returns {Promise<{title: string, items: Array<{title: string, url: string}>}>}
 */
async function fetchRssFeed(feedUrl) {
    try {
        let parsedData;

        if (typeof DOMParser !== 'undefined') {
            // Extension page context (side panel) — fetch and parse locally
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            try {
                const response = await fetch(feedUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const xmlText = await response.text();
                parsedData = parseRssFeedXml(xmlText);
            } catch (err) {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                throw err;
            }
        } else {
            // Service Worker context — delegate fetch + parse to offscreen document
            await ensureOffscreenDocument();

            const result = await chrome.runtime.sendMessage({
                action: 'fetchAndParseRssFeed',
                feedUrl: feedUrl,
                timeoutMs: FETCH_TIMEOUT_MS
            });

            if (!result || !result.success) {
                throw new Error(result?.error || 'Failed to fetch RSS feed');
            }
            parsedData = result.data;
        }

        // Validate we got some items
        if (parsedData.items.length === 0) {
            console.warn('RSS: No items found in feed:', feedUrl);
        }

        return parsedData;
    } catch (err) {
        console.error('Error fetching RSS feed:', feedUrl, err);
        throw err;
    }
}

// --- Offscreen Document Management ---
// 已抽出至 modules/offscreenManager.js（與 Telegram 共用單一 offscreen document，
// BASE-018 TG2b）。ensureOffscreenDocument 由該模組匯入。

/**
 * Extracts content from an XML tag.
 * @param {string} xml - XML string to search.
 * @param {string} tagName - Tag name to extract.
 * @returns {string|null} Tag content or null.
 */
function extractTagContent(xml, tagName) {
    // Handle CDATA sections
    const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) {
        return cdataMatch[1];
    }

    // Handle regular content
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Extracts href from Atom link element.
 * @param {string} xml - XML string containing link element.
 * @returns {string|null} Link href or null.
 */
function extractAtomLink(xml) {
    // Try to find alternate link first
    const alternateMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
    if (alternateMatch) return alternateMatch[1];

    // Try href attribute in any link
    const hrefMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (hrefMatch) return hrefMatch[1];

    // Try link content (rare but possible)
    return extractTagContent(xml, 'link');
}

/**
 * Extracts link from guid element if isPermaLink is true.
 * @param {string} xml - XML string containing guid element.
 * @returns {string|null} Link from guid or null.
 */
function extractLinkFromGuid(xml) {
    // Check for guid with isPermaLink="true"
    const guidPermaMatch = xml.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([^<]+)<\/guid>/i);
    if (guidPermaMatch) return guidPermaMatch[1].trim();

    // Some feeds have guid content that looks like a URL
    const guidContent = extractTagContent(xml, 'guid');
    if (guidContent && (guidContent.startsWith('http://') || guidContent.startsWith('https://'))) {
        return guidContent;
    }

    return null;
}

/**
 * Decodes common XML entities.
 * @param {string} str - String with XML entities.
 * @returns {string} Decoded string.
 */
function decodeXmlEntities(str) {
    if (!str) return '';
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&amp;/g, '&');
}

/**
 * Parses a date string to Unix timestamp (ms).
 * @param {string} dateStr - Date string from RSS/Atom feed.
 * @returns {number} Timestamp in milliseconds, or 0 if parsing fails.
 */
function parseDateToTimestamp(dateStr) {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

// --- Public API ---

/**
 * Initializes RSS manager and loads subscriptions.
 * Note: Alarm listener should be registered in background.js
 */
export async function initRssManager() {
    await loadSubscriptions();
    await loadFetchedHashes();
    await setupAllAlarms();
}

/**
 * Handles alarm events for RSS fetching.
 * Should be called from background.js alarm listener.
 * @param {chrome.alarms.Alarm} alarm - Alarm that fired.
 */
export async function handleAlarm(alarm) {
    if (!alarm.name.startsWith(ALARM_PREFIX)) return;

    // Ensure data is loaded
    if (subscriptions.length === 0) {
        await loadSubscriptions();
    }
    if (fetchedHashes.size === 0) {
        await loadFetchedHashes();
    }

    const subscriptionId = alarm.name.replace(ALARM_PREFIX, '');
    await fetchNow(subscriptionId);
}

/**
 * Adds a new RSS subscription.
 * @param {string} feedUrl - The RSS feed URL.
 * @returns {Promise<RssSubscription>}
 * @throws {Error} If URL already exists or feed is invalid.
 */
export async function addSubscription(feedUrl) {
    // Check for duplicate URL
    const normalizedUrl = feedUrl.trim().toLowerCase();
    const existingSub = subscriptions.find(s => s.url.toLowerCase() === normalizedUrl);
    if (existingSub) {
        throw new Error(`Already subscribed: ${existingSub.title}`);
    }

    // Validate and fetch feed to get title
    const feed = await fetchRssFeed(feedUrl);

    const sub = {
        id: generateId(),
        url: feedUrl,
        title: feed.title,
        interval: '24h',
        enabled: true,
        lastFetched: 0,
        updatedAt: nextTimestamp(0, Date.now())
    };

    subscriptions.push(sub);
    await saveSubscriptions();
    await setupAlarm(sub);

    return sub;
}

/**
 * Removes an RSS subscription.
 * @param {string} subscriptionId - The subscription ID.
 */
export async function removeSubscription(subscriptionId) {
    await clearAlarm(subscriptionId);
    const removed = subscriptions.find(s => s.id === subscriptionId);
    subscriptions = subscriptions.filter(s => s.id !== subscriptionId);
    // Tombstone BEFORE saving so the deletion propagates through the Drive merge
    // instead of a sibling device resurrecting it on the next union.
    await writeTombstone(subscriptionId, removed);
    await saveSubscriptions();
}

/**
 * Updates subscription settings.
 * @param {string} subscriptionId - The subscription ID.
 * @param {Partial<RssSubscription>} updates - The updates to apply.
 */
export async function updateSubscription(subscriptionId, updates) {
    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (!sub) return;

    Object.assign(sub, updates);
    // Bump the monotonic edit clock so this user edit wins the cross-device
    // merge (and beats any older tombstone for this id).
    sub.updatedAt = nextTimestamp(sub.updatedAt, Date.now());

    await saveSubscriptions();

    // Handle enable/disable changes
    if (updates.enabled !== undefined || updates.interval !== undefined) {
        await clearAlarm(subscriptionId);
        if (sub.enabled) {
            await setupAlarm(sub);
        }
    }
}

/**
 * Gets all subscriptions.
 * @returns {RssSubscription[]}
 */
export function getSubscriptions() {
    return [...subscriptions];
}

/**
 * Manually triggers a fetch for a subscription.
 * Uses hash-based deduplication to avoid adding duplicate items.
 * @param {string} subscriptionId - The subscription ID.
 * @returns {Promise<number>} Number of new items added.
 */
export async function fetchNow(subscriptionId) {
    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (!sub) return 0;

    const fetchStartTime = Date.now();
    const isFirstFetch = sub.lastFetched === 0;

    try {
        const feed = await fetchRssFeed(sub.url);
        let addedCount = 0;

        // On first fetch, limit to 5 items to avoid spam
        // On subsequent fetches, process all items (up to 20)
        const itemsToProcess = isFirstFetch
            ? feed.items.slice(0, 5)
            : feed.items.slice(0, 20);

        // Process items using hash-based deduplication
        for (const item of itemsToProcess) {
            try {
                // Check if this item was already fetched using hash
                const alreadyFetched = await isHashFetched(item.url);
                if (alreadyFetched) {
                    continue;
                }

                // Add to reading list
                await addToReadingList(item.url, item.title);

                // Mark as fetched
                await markAsFetched(item.url);
                addedCount++;
            } catch (itemErr) {
                console.warn(`RSS: Failed to add item "${item.title}":`, itemErr.message);
                // Continue with next item
            }
        }

        // Save hashes to local storage
        await saveFetchedHashes();

        // Update last fetched time. Field-level write (NOT a whole-array dump)
        // so this SW fetch loop cannot clobber a concurrent interval/enable edit
        // made in the options page.
        sub.lastFetched = fetchStartTime;
        await persistLastFetched(sub.id, fetchStartTime);

        console.log(`RSS [${sub.title}]: Added ${addedCount} new items (hash-based)`);
        return addedCount;
    } catch (err) {
        console.error('Error fetching subscription:', subscriptionId, err);
        await recordFetchFailure(subscriptionId, sub.url, err);
        return 0;
    }
}

/**
 * Validates an RSS feed URL by attempting to fetch it.
 * @param {string} feedUrl - URL to validate.
 * @returns {Promise<{valid: boolean, title?: string, error?: string}>}
 */
export async function validateFeedUrl(feedUrl) {
    try {
        const feed = await fetchRssFeed(feedUrl);
        return { valid: true, title: feed.title };
    } catch (err) {
        return { valid: false, error: err.message };
    }
}
