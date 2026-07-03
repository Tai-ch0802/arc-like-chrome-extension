/**
 * Reading List Summary Recorder
 *
 * Listens for chrome.readingList.onEntryAdded. If the just-added URL matches
 * a currently-open tab, we scrape its content via the shared extractor and
 * run it through the Summarizer API, then persist the result in the summary
 * store so the user can read the summary later — even offline, or after the
 * source page is gone.
 *
 * Design choices:
 * - We only summarize when a live tab matches the URL. Without that, we'd
 *   have to chrome.tabs.create + scrape + close to extract text, which is
 *   intrusive and frequently breaks (auth, paywalls, JS rendering).
 *   v1 stays conservative; manual "summarize now" can come later.
 * - Multiple open sidepanels would otherwise race to summarize the same
 *   entry. We dedupe by checking the store before kicking off work.
 * - aiManager.summarizeText gates itself on `=== 'available'`, so this
 *   listener will silently skip if the model isn't already downloaded —
 *   never triggers a multi-GB background download on its own.
 */
import * as state from '../stateManager.js';
import * as aiManager from '../aiManager.js';
import { extractPageContent } from '../utils/pageContentExtractor.js';
import * as summaryStore from './summaryStore.js';

let initialized = false;

export function initSummaryRecorder() {
    if (initialized) return;
    if (!chrome.readingList || !chrome.readingList.onEntryAdded) return;
    initialized = true;
    chrome.readingList.onEntryAdded.addListener(handleEntryAdded);
}

async function handleEntryAdded(entry) {
    try {
        if (!state.isReadingListSummaryEnabled()) return;
        if (!entry || !entry.url) return;
        // Dedupe — another sidepanel might have already summarized this URL,
        // or it was summarized in a previous session.
        if (summaryStore.hasSummary(entry.url)) return;

        // Only proceed when there's a live tab with this URL — otherwise we'd
        // need to open a fresh tab just to scrape, which is intrusive and
        // routinely fails on paywalled / auth-gated pages.
        const tabs = await chrome.tabs.query({ url: entry.url }).catch(() => []);
        const tab = tabs.find(t => typeof t.id === 'number');
        if (!tab) return;

        const text = await extractPageContent(tab.id, { maxLen: await aiManager.getInputCharBudget() });
        if (!text) return;

        const domain = safeHost(entry.url);
        const summary = await aiManager.summarizeText(text, domain);
        if (!summary) return;

        await summaryStore.setSummary(entry.url, summary);
        document.dispatchEvent(new CustomEvent('readingListSummaryAdded', {
            detail: { url: entry.url },
        }));
    } catch (err) {
        // Best-effort; never let a summarize failure surface to the user.
        console.warn('[rlSummary] failed to summarize entry', err);
    }
}

function safeHost(url) {
    try { return new URL(url).hostname; } catch { return ''; }
}
