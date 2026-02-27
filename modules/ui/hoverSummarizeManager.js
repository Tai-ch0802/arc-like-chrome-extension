/**
 * Hover Summarize Manager
 * Core logic for the Hover Summarize feature.
 * Handles hover detection, content extraction, AI summarization, and caching.
 */
import * as api from '../apiManager.js';
import * as aiManager from '../aiManager.js';
import * as state from '../stateManager.js';
import * as tooltip from './hoverTooltip.js';
import { tabListContainer } from './elements.js';

// === State ===

/** @type {Map<number, {summary: string, url: string}>} tabId → cached summary */
const summaryCache = new Map();

/** @type {number|null} Hover debounce timer */
let hoverTimerId = null;

/** @type {AbortController|null} For cancelling in-progress AI calls */
let currentAbortController = null;

/** @type {number|null} The tab ID currently being hovered */
let currentHoveredTabId = null;

// === Public API ===

/**
 * Initializes the Hover Summarize feature.
 * Uses event delegation on the tab list container.
 */
export function init() {
    if (!tabListContainer) {
        console.warn('Hover Summarize: tabListContainer not found');
        return;
    }

    // Event delegation for mouseenter/mouseleave on tab items
    tabListContainer.addEventListener('mouseover', handleMouseOver);
    tabListContainer.addEventListener('mouseout', handleMouseOut);
}

/**
 * Invalidates the cache for a specific tab (e.g., when URL changes).
 * @param {number} tabId 
 */
export function invalidateCache(tabId) {
    summaryCache.delete(tabId);
}

/**
 * Removes a tab from cache (e.g., when tab is closed).
 * @param {number} tabId 
 */
export function removeFromCache(tabId) {
    summaryCache.delete(tabId);
}

// === Event Handlers ===

/**
 * @param {MouseEvent} event 
 */
function handleMouseOver(event) {
    const tabItem = event.target.closest('.tab-item');
    if (!tabItem) return;

    const tabId = parseInt(tabItem.dataset.tabId, 10);
    if (isNaN(tabId) || tabId === currentHoveredTabId) return;

    // Clear any previous hover timer
    clearHoverState();
    currentHoveredTabId = tabId;

    // Start 2-second debounce timer (FR-1.01)
    hoverTimerId = setTimeout(() => {
        triggerSummarize(tabId, tabItem);
    }, 2000);
}

/**
 * @param {MouseEvent} event 
 */
function handleMouseOut(event) {
    const tabItem = event.target.closest('.tab-item');
    if (!tabItem) return;

    const tabId = parseInt(tabItem.dataset.tabId, 10);
    if (tabId === currentHoveredTabId) {
        clearHoverState();
        tooltip.hide();
    }
}

/**
 * Clears the hover state and cancels any in-progress operations.
 */
function clearHoverState() {
    if (hoverTimerId) {
        clearTimeout(hoverTimerId);
        hoverTimerId = null;
    }
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    currentHoveredTabId = null;
}

// === Core Logic ===

/**
 * Triggers the summarize flow for a tab.
 * @param {number} tabId 
 * @param {HTMLElement} anchorEl 
 */
async function triggerSummarize(tabId, anchorEl) {
    // Check if feature is enabled
    if (!state.isHoverSummarizeEnabled()) return;

    // Try to get the tab info for URL and title
    let tab;
    try {
        tab = await chrome.tabs.get(tabId);
    } catch {
        return; // Tab no longer exists
    }
    if (!tab) return;

    const domain = getDomain(tab.url);

    // Check cache first (FR-4.01, FR-4.02)
    const cached = getCachedSummary(tabId, tab.url);
    if (cached) {
        tooltip.showSummary(cached, domain, anchorEl);
        return;
    }

    // Check if Summarizer API is available
    const summarizeReady = await aiManager.checkSummarizerReadiness();
    if (!summarizeReady) {
        // Fallback: show URL + Title (FR-3.04)
        const fallback = buildFallbackText(tab);
        tooltip.showSummary(fallback, domain, anchorEl);
        return;
    }

    // Show loading state
    tooltip.showLoading(anchorEl);

    // Create AbortController for this request
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    try {
        // Extract page content (FR-2.01)
        const pageText = await extractPageContent(tabId);
        if (signal.aborted) return;

        // If extraction failed, use fallback
        if (!pageText) {
            const fallback = buildFallbackText(tab);
            tooltip.showSummary(fallback, domain, anchorEl);
            setCachedSummary(tabId, tab.url, fallback);
            return;
        }

        // Get or create Summarizer session (Lazy strategy)
        const session = await aiManager.getOrCreateSummarizerSession();
        if (signal.aborted) return;

        if (!session) {
            const fallback = buildFallbackText(tab);
            tooltip.showSummary(fallback, domain, anchorEl);
            return;
        }

        // Use streaming for progressive display
        const stream = session.summarizeStreaming(pageText, {
            context: `Web page from ${domain}. Provide a concise one-sentence summary.`,
        });

        let fullSummary = '';
        for await (const chunk of stream) {
            if (signal.aborted) return;
            fullSummary += chunk; // Accumulate delta chunks
            tooltip.updateStreamChunk(fullSummary);
        }

        // Stream complete — show final summary with domain meta + cache
        if (fullSummary && !signal.aborted) {
            setCachedSummary(tabId, tab.url, fullSummary);
            tooltip.showSummary(fullSummary, domain, anchorEl);
        }

    } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Hover Summarize error:', err);

        // Fallback on any error
        const fallback = buildFallbackText(tab);
        tooltip.showSummary(fallback, domain, anchorEl);
    } finally {
        currentAbortController = null;
    }
}

// === Content Extraction ===

/**
 * Extracts visible text from a tab's page content.
 * @param {number} tabId 
 * @returns {Promise<string|null>} Truncated text or null if extraction fails
 */
async function extractPageContent(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const clone = document.body.cloneNode(true);
                clone.querySelectorAll('script, style, nav, footer, header, aside, [role="navigation"], [role="banner"]')
                    .forEach(el => el.remove());
                return clone.innerText.replace(/\s+/g, ' ').trim();
            }
        });

        const text = results?.[0]?.result || '';
        if (text.length < 20) return null; // Too little content
        return text.substring(0, 1500); // Token limit guard (FR-2.02)
    } catch {
        // chrome://, chrome-extension://, or restricted pages (FR-2.03)
        return null;
    }
}

// === Cache Management ===

/**
 * @param {number} tabId 
 * @param {string} currentUrl 
 * @returns {string|null}
 */
function getCachedSummary(tabId, currentUrl) {
    const cached = summaryCache.get(tabId);
    if (cached && cached.url === currentUrl) {
        return cached.summary;
    }
    // URL changed → clear stale cache (FR-4.03)
    if (cached) summaryCache.delete(tabId);
    return null;
}

/**
 * @param {number} tabId 
 * @param {string} url 
 * @param {string} summary 
 */
function setCachedSummary(tabId, url, summary) {
    summaryCache.set(tabId, { summary, url });
}

// === Helpers ===

/**
 * Extracts domain from a URL.
 * @param {string} url 
 * @returns {string}
 */
function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url || '';
    }
}

/**
 * Builds fallback text when AI is not available.
 * @param {chrome.tabs.Tab} tab 
 * @returns {string}
 */
function buildFallbackText(tab) {
    const domain = getDomain(tab.url);
    const title = tab.title || '';
    return `🌐 ${domain}\n${title}`;
}
