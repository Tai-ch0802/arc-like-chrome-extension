// --- Offscreen Document Script ---
// This script runs in a hidden offscreen document that has access to DOM APIs.
// It's used for parsing RSS/Atom XML feeds using DOMParser.

/**
 * Parses an RSS/Atom feed XML string and extracts title and items.
 * @param {string} xmlText - The raw XML text of the feed.
 * @returns {{title: string, items: Array<{title: string, url: string}>}}
 */
function parseRssFeed(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('XML Parse Error: ' + parseError.textContent.slice(0, 100));
    }

    // Detect feed type
    const feedElement = doc.querySelector('feed'); // Atom
    const channelElement = doc.querySelector('channel'); // RSS

    let feedTitle = '';
    let items = [];

    if (feedElement) {
        // Atom format
        feedTitle = getTextContent(feedElement, 'title') || '';

        const entries = feedElement.querySelectorAll('entry');
        entries.forEach(entry => {
            const title = getTextContent(entry, 'title') || '';
            const url = getAtomLink(entry) || '';
            if (url) {
                items.push({ title, url });
            }
        });
    } else if (channelElement) {
        // RSS format
        // Get channel title (direct child, not from items)
        const channelTitleEl = channelElement.querySelector(':scope > title');
        feedTitle = channelTitleEl ? channelTitleEl.textContent.trim() : '';

        const rssItems = channelElement.querySelectorAll('item');
        rssItems.forEach(item => {
            const title = getTextContent(item, 'title') || '';
            const url = getTextContent(item, 'link') || getLinkFromGuid(item) || '';
            if (url) {
                items.push({ title: title.trim(), url: url.trim() });
            }
        });
    } else {
        throw new Error('Unknown feed format: neither RSS nor Atom detected');
    }

    return { title: feedTitle.trim(), items };
}

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
    // Try alternate link first
    const alternateLink = entry.querySelector('link[rel="alternate"]');
    if (alternateLink && alternateLink.hasAttribute('href')) {
        return alternateLink.getAttribute('href');
    }

    // Try any link with href
    const anyLink = entry.querySelector('link[href]');
    if (anyLink) {
        return anyLink.getAttribute('href');
    }

    // Try link content (rare)
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

    // If isPermaLink is explicitly "true" or not set (default is true for URLs)
    if (isPermaLink === 'true' ||
        (isPermaLink !== 'false' && (content.startsWith('http://') || content.startsWith('https://')))) {
        return content;
    }

    return null;
}

// --- Telegram (BASE-018 TG2b) ---
// GramJS 只在此 offscreen document 執行(DOM context 支援 dynamic import + WebSocket;
// MV3 SW 兩者皆不支援/不宜)。tgAdapter/tgClient 以 dynamic import 隔離載入——只有
// SW 發 tg:connect 時才載入 2.6M bundle,不啟用 tg 的用戶零成本。收到 NewMessage 主動
// post tg:raw 給 SW 的既有 newswire 管線;狀態變化 post tg:status;SW watchdog 以 tg:ping 探活。
let tgAdapter = null;
let lastTgStatus = 'disabled';

async function tgConnect(cfg) {
    const { createTgAdapter } = await import('./modules/newswire/tgAdapter.js');
    if (tgAdapter) { try { tgAdapter.disconnect(); } catch (e) { /* noop */ } tgAdapter = null; }
    tgAdapter = createTgAdapter(cfg, {
        onRaw: (raw) => { chrome.runtime.sendMessage({ action: 'tg:raw', raw }).catch(() => { /* SW 忙/回收 */ }); },
        onStatus: (status) => {
            lastTgStatus = status;
            chrome.runtime.sendMessage({ action: 'tg:status', status }).catch(() => { /* noop */ });
        },
    });
    tgAdapter.connect();
}

function tgDisconnect() {
    if (tgAdapter) { try { tgAdapter.disconnect(); } catch (e) { /* noop */ } tgAdapter = null; }
    lastTgStatus = 'disabled';
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'parseRssFeed') {
        try {
            const result = parseRssFeed(message.xmlText);
            sendResponse({ success: true, data: result });
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }
        return true; // Keep channel open for async response
    }

    if (message.action === 'fetchAndParseRssFeed') {
        // Fetch and parse in the offscreen document context
        // This is used by the Service Worker which cannot use fetch() reliably for some URLs
        (async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), message.timeoutMs || 10000);

                const response = await fetch(message.feedUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    sendResponse({ success: false, error: `HTTP ${response.status}` });
                    return;
                }

                const xmlText = await response.text();
                const result = parseRssFeed(xmlText);
                sendResponse({ success: true, data: result });
            } catch (err) {
                sendResponse({ success: false, error: err.name === 'AbortError' ? 'Request timeout' : err.message });
            }
        })();
        return true; // Keep channel open for async response
    }

    // --- Telegram (BASE-018 TG2b) ---
    if (message.action === 'tg:connect') {
        tgConnect(message.cfg).catch(() => {
            // 動態載入/建構失敗:回報 retrying,SW watchdog 會再排程重連。
            lastTgStatus = 'retrying';
            chrome.runtime.sendMessage({ action: 'tg:status', status: 'retrying' }).catch(() => { /* noop */ });
        });
        return false; // 無同步 response;狀態經 tg:status 主動 post
    }
    if (message.action === 'tg:disconnect') {
        tgDisconnect();
        return false;
    }
    if (message.action === 'tg:ping') {
        sendResponse({ alive: !!tgAdapter && tgAdapter.isAlive(), status: lastTgStatus });
        return true;
    }
});
