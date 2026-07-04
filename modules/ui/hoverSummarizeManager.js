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
import { extractPageContent } from '../utils/pageContentExtractor.js';

// === State ===

/** @type {Map<number, {summary: string, url: string, timestamp: number}>} tabId → cached summary */
const summaryCache = new Map();

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

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

    // Suppress the row's native title tooltip up front — before the browser's
    // ~1s hover delay — so it never pops up to overlap/cover our summary
    // tooltip. Gated on the feature being on: when it's off no tooltip of ours
    // appears, so we must keep the native title+URL preview intact.
    if (state.isHoverSummarizeEnabled()) {
        tooltip.suppressAnchorTitle(tabItem);
    }

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
    // Give the row back its native title tooltip now that we no longer own it.
    tooltip.restoreAnchorTitle();
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
        // Extract page content (FR-2.01) — budget depends on the active provider
        const maxLen = await aiManager.getInputCharBudget();
        const pageText = await extractPageContent(tabId, { maxLen });
        if (signal.aborted) return;

        // If extraction failed, use fallback
        if (!pageText) {
            const fallback = buildFallbackText(tab);
            tooltip.showSummary(fallback, domain, anchorEl);
            setCachedSummary(tabId, tab.url, fallback);
            return;
        }

        // Summarize via the active provider. Both builtin and cloud providers
        // stream delta chunks for progressive rendering.
        // @see https://developer.chrome.com/docs/ai/render-llm-responses
        const fullSummary = await aiManager.summarizePageStreaming(pageText, domain, {
            onChunk: (chunk) => tooltip.updateStreamChunk(chunk),
            signal,
        });
        if (signal.aborted) return;

        if (fullSummary) {
            setCachedSummary(tabId, tab.url, fullSummary);
            tooltip.showSummary(fullSummary, domain, anchorEl);
        } else {
            const fallback = buildFallbackText(tab);
            tooltip.showSummary(fallback, domain, anchorEl);
        }

    } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Hover Summarize error:', err);

        // Model may have been purged or updated mid-session.
        // Destroy the cached session so it's rebuilt on next hover.
        // @see https://developer.chrome.com/docs/ai/understand-built-in-model-management
        aiManager.destroySummarizerSession();

        // Fallback on any error
        const fallback = buildFallbackText(tab);
        tooltip.showSummary(fallback, domain, anchorEl);
    } finally {
        currentAbortController = null;
    }
}

// === Content Extraction ===

// extractPageContent moved to modules/utils/pageContentExtractor.js so it can
// be reused by the reading-list summary memory feature.

// === Cache Management ===

/**
 * @param {number} tabId 
 * @param {string} currentUrl 
 * @returns {string|null}
 */
function getCachedSummary(tabId, currentUrl) {
    const cached = summaryCache.get(tabId);
    if (!cached) return null;

    // URL changed → clear stale cache (FR-4.03)
    if (cached.url !== currentUrl) {
        summaryCache.delete(tabId);
        return null;
    }

    // TTL expired → clear and return null to trigger re-summarization
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        summaryCache.delete(tabId);
        return null;
    }

    return cached.summary;
}

/**
 * @param {number} tabId 
 * @param {string} url 
 * @param {string} summary 
 */
function setCachedSummary(tabId, url, summary) {
    summaryCache.set(tabId, { summary, url, timestamp: Date.now() });
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
    return `${domain}\n${title}`;
}
