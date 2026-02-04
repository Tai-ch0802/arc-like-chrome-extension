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
});
