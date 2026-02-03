// --- RSS Manager Module ---
// Manages RSS subscription storage, scheduling, and fetching

import * as api from './apiManager.js';
import { addToReadingList, isUrlInReadingList } from './readingListManager.js';

// --- Constants ---
const RSS_SUBSCRIPTIONS_KEY = 'rssSubscriptions';
const DELIMITER = '|';
const ESCAPE_CHAR = '\\|';
const ALARM_PREFIX = 'rss_fetch_';
const FETCH_TIMEOUT_MS = 10000; // 10 seconds

// --- In-memory cache ---
let subscriptions = [];

// --- Serialization/Deserialization ---

/**
 * Escapes pipe characters in a string for storage.
 * @param {string} str - String to escape.
 * @returns {string} Escaped string.
 */
function escapeDelimiter(str) {
    return str.replace(/\|/g, ESCAPE_CHAR);
}

/**
 * Unescapes pipe characters in a string.
 * @param {string} str - String to unescape.
 * @returns {string} Unescaped string.
 */
function unescapeDelimiter(str) {
    return str.replace(/\\\|/g, '|');
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
        sub.lastFetched
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
        lastFetched: parseInt(parts[5], 10) || 0
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
 * Loads subscriptions from storage into memory.
 */
async function loadSubscriptions() {
    const result = await api.getStorage('sync', [RSS_SUBSCRIPTIONS_KEY]);
    const stored = result[RSS_SUBSCRIPTIONS_KEY] || [];
    subscriptions = stored.map(parseSubscription);
}

/**
 * Saves subscriptions to storage.
 */
async function saveSubscriptions() {
    const serialized = subscriptions.map(serializeSubscription);
    await api.setStorage('sync', { [RSS_SUBSCRIPTIONS_KEY]: serialized });
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

/**
 * Fetches and parses an RSS feed with timeout.
 * @param {string} feedUrl - RSS feed URL.
 * @returns {Promise<{title: string, items: Array<{title: string, url: string, pubDate: number}>}>}
 */
async function fetchRssFeed(feedUrl) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(feedUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'application/xml');

        // Check for parse errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid RSS feed format');
        }

        // Support both RSS and Atom formats
        const isAtom = !!doc.querySelector('feed');

        let feedTitle = '';
        let items = [];

        if (isAtom) {
            // Atom format
            feedTitle = doc.querySelector('feed > title')?.textContent || feedUrl;
            const entries = doc.querySelectorAll('entry');
            items = Array.from(entries).map(entry => {
                // Atom uses <updated> or <published>
                const dateStr = entry.querySelector('updated')?.textContent ||
                    entry.querySelector('published')?.textContent ||
                    entry.querySelector('pubDate')?.textContent || '';
                return {
                    title: entry.querySelector('title')?.textContent || '',
                    url: entry.querySelector('link')?.getAttribute('href') || '',
                    pubDate: parseDateToTimestamp(dateStr)
                };
            }).filter(item => item.url);
        } else {
            // RSS format
            feedTitle = doc.querySelector('channel > title')?.textContent || feedUrl;
            const rssItems = doc.querySelectorAll('item');
            items = Array.from(rssItems).map(item => {
                // RSS uses <pubDate>
                const dateStr = item.querySelector('pubDate')?.textContent || '';
                return {
                    title: item.querySelector('title')?.textContent || '',
                    url: item.querySelector('link')?.textContent || '',
                    pubDate: parseDateToTimestamp(dateStr)
                };
            }).filter(item => item.url);
        }

        return { title: feedTitle, items };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        console.error('Error fetching RSS feed:', feedUrl, err);
        throw err;
    }
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
    await setupAllAlarms();
}

/**
 * Handles alarm events for RSS fetching.
 * Should be called from background.js alarm listener.
 * @param {chrome.alarms.Alarm} alarm - Alarm that fired.
 */
export async function handleAlarm(alarm) {
    if (!alarm.name.startsWith(ALARM_PREFIX)) return;

    // Ensure subscriptions are loaded
    if (subscriptions.length === 0) {
        await loadSubscriptions();
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
        lastFetched: 0
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
    subscriptions = subscriptions.filter(s => s.id !== subscriptionId);
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

    const wasEnabled = sub.enabled;
    Object.assign(sub, updates);

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
 * @param {string} subscriptionId - The subscription ID.
 * @returns {Promise<number>} Number of new items added.
 */
export async function fetchNow(subscriptionId) {
    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (!sub) return 0;

    const fetchStartTime = Date.now();

    try {
        const feed = await fetchRssFeed(sub.url);
        let addedCount = 0;

        // Filter items: only those published after lastFetched
        // If lastFetched is 0 (first fetch), take only items from the last 24 hours
        const cutoffTime = sub.lastFetched > 0
            ? sub.lastFetched
            : Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

        // Filter by pubDate, limit to 10 to avoid spam
        let newItems = feed.items
            .filter(item => item.pubDate > cutoffTime)
            .slice(0, 10);

        // Issue #5: First fetch fallback - if no items match, take top 5
        if (sub.lastFetched === 0 && newItems.length === 0) {
            newItems = feed.items.slice(0, 5);
            console.log(`RSS [${sub.title}]: First fetch fallback, taking top 5 items`);
        }

        // Issue #3: Try-catch per item to prevent one failure from stopping all
        for (const item of newItems) {
            try {
                // Skip items without valid pubDate if we have a lastFetched
                if (sub.lastFetched > 0 && item.pubDate === 0) {
                    // Fall back to URL existence check for items without pubDate
                    const exists = await isUrlInReadingList(item.url);
                    if (exists) continue;
                }

                await addToReadingList(item.url, item.title);
                addedCount++;
            } catch (itemErr) {
                console.warn(`RSS: Failed to add item "${item.title}":`, itemErr.message);
                // Continue with next item
            }
        }

        // Update last fetched time to when we started the fetch
        sub.lastFetched = fetchStartTime;
        await saveSubscriptions();

        console.log(`RSS [${sub.title}]: Added ${addedCount} new items`);
        return addedCount;
    } catch (err) {
        console.error('Error fetching subscription:', subscriptionId, err);
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
