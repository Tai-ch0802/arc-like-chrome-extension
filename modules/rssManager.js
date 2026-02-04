// --- RSS Manager Module ---
// Manages RSS subscription storage, scheduling, and fetching

import * as api from './apiManager.js';
import { addToReadingList } from './readingListManager.js';

// --- Constants ---
const RSS_SUBSCRIPTIONS_KEY = 'rssSubscriptions';
const RSS_FETCHED_HASHES_KEY = 'rssFetchedHashes';
const MAX_STORED_HASHES = 500; // Limit stored hashes to prevent storage bloat
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

// --- Hash Storage Operations (Local) ---

/**
 * Loads fetched hashes from local storage.
 */
async function loadFetchedHashes() {
    const result = await api.getStorage('local', [RSS_FETCHED_HASHES_KEY]);
    const stored = result[RSS_FETCHED_HASHES_KEY] || [];
    fetchedHashes = new Set(stored);
}

/**
 * Saves fetched hashes to local storage.
 * Limits to MAX_STORED_HASHES to prevent storage bloat.
 */
async function saveFetchedHashes() {
    let hashArray = Array.from(fetchedHashes);

    // Keep only the most recent hashes if exceeding limit
    if (hashArray.length > MAX_STORED_HASHES) {
        hashArray = hashArray.slice(-MAX_STORED_HASHES);
        fetchedHashes = new Set(hashArray);
    }

    await api.setStorage('local', { [RSS_FETCHED_HASHES_KEY]: hashArray });
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
 * 
 * Uses the Offscreen API to parse XML with DOMParser in a hidden document context,
 * since DOMParser is not available in the Service Worker environment.
 * 
 * @param {string} feedUrl - RSS feed URL.
 * @returns {Promise<{title: string, items: Array<{title: string, url: string}>}>}
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

        const xmlText = await response.text();

        // Ensure offscreen document exists
        await ensureOffscreenDocument();

        // Send XML to offscreen document for parsing with DOMParser
        const result = await chrome.runtime.sendMessage({
            action: 'parseRssFeed',
            xmlText: xmlText
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to parse RSS feed');
        }

        // Validate we got some items
        if (result.data.items.length === 0) {
            console.warn('RSS: No items found in feed:', feedUrl);
        }

        return result.data;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        console.error('Error fetching RSS feed:', feedUrl, err);
        throw err;
    }
}

// --- Offscreen Document Management ---

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
let creatingOffscreenDocument = null;

/**
 * Ensures the offscreen document exists, creating it if necessary.
 * Uses a singleton pattern to prevent multiple document creations.
 */
async function ensureOffscreenDocument() {
    // Check if document already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });

    if (existingContexts.length > 0) {
        return; // Document already exists
    }

    // Prevent multiple concurrent creation attempts
    if (creatingOffscreenDocument) {
        await creatingOffscreenDocument;
        return;
    }

    creatingOffscreenDocument = chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse RSS/Atom XML feeds using DOMParser'
    });

    await creatingOffscreenDocument;
    creatingOffscreenDocument = null;
}

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
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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

        // Update last fetched time
        sub.lastFetched = fetchStartTime;
        await saveSubscriptions();

        console.log(`RSS [${sub.title}]: Added ${addedCount} new items (hash-based)`);
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
