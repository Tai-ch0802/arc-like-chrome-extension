/**
 * Page Reader — one-click AI digest of the current tab.
 *
 * Extracts the visible text of the active tab and asks the active AI
 * provider (aiManager) for a structured digest (TL;DR + key points),
 * rendered in a modal. The input budget scales with the provider
 * (builtin Nano ~1.5K chars; cloud providers much more).
 */
import * as api from '../apiManager.js';
import * as aiManager from '../aiManager.js';
import * as state from '../stateManager.js';
import * as modal from '../modalManager.js';
import { extractPageContent } from '../utils/pageContentExtractor.js';

/** URLs chrome.scripting can never inject into. */
const NON_SCRIPTABLE = /^(chrome|chrome-extension|edge|about|devtools|view-source):/i;
const CHROME_WEBSTORE = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

/**
 * Initializes the Page Reader button (visibility + click handler).
 */
export function initPageReader() {
    const btn = document.getElementById('page-reader-btn');
    if (!btn) return;

    btn.addEventListener('click', () => { openPageReader(); });

    // Apply initial visibility state (mirrors aiGrouperUI's convention)
    if (!state.isPageReaderVisible()) {
        btn.style.display = 'none';
    }
    document.addEventListener('pageReaderVisibilityChanged', (e) => {
        btn.style.display = e.detail.visible ? '' : 'none';
    });
}

/**
 * Runs the full digest flow for the active tab.
 */
export async function openPageReader() {
    let tab = null;
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = tabs?.[0] || null;
    } catch { /* fall through to the guard below */ }

    const root = document.createElement('div');
    root.className = 'page-reader-digest';
    const status = document.createElement('div');
    status.className = 'page-reader-status';
    root.appendChild(status);

    modal.showCustomDialog({
        title: api.getMessage('pageReaderModalTitle') || 'Page digest',
        content: root,
    });

    if (!tab || !tab.url || NON_SCRIPTABLE.test(tab.url) || CHROME_WEBSTORE.test(tab.url)) {
        status.textContent = api.getMessage('pageReaderNotScriptable')
            || 'This page cannot be read (browser internal page).';
        return;
    }

    status.textContent = api.getMessage('pageReaderLoading') || 'Reading page…';

    try {
        const maxLen = await aiManager.getInputCharBudget();
        const text = await extractPageContent(tab.id, { maxLen });
        if (!text) {
            status.textContent = api.getMessage('pageReaderNoContent')
                || 'No readable text found on this page.';
            return;
        }

        const digest = await aiManager.generatePageDigest({
            title: tab.title || '',
            url: tab.url,
            text,
        });
        if (!digest) {
            status.textContent = api.getMessage('pageReaderFailed')
                || 'Could not generate a digest. Check AI settings and try again.';
            return;
        }

        renderDigest(root, digest);
    } catch (err) {
        console.warn('[pageReader] digest failed:', err);
        status.textContent = api.getMessage('pageReaderFailed')
            || 'Could not generate a digest. Check AI settings and try again.';
    }
}

/**
 * Renders the digest into the modal. All model output goes through
 * textContent — never innerHTML — so a malicious page can't inject markup.
 * @param {HTMLElement} root
 * @param {{tldr: string, keyPoints: string[]}} digest
 */
function renderDigest(root, digest) {
    root.innerHTML = '';

    const tldrHeader = document.createElement('h4');
    tldrHeader.className = 'page-reader-header';
    tldrHeader.textContent = api.getMessage('pageReaderTldrHeader') || 'TL;DR';
    root.appendChild(tldrHeader);

    const tldr = document.createElement('p');
    tldr.className = 'page-reader-tldr';
    tldr.textContent = digest.tldr;
    root.appendChild(tldr);

    if (digest.keyPoints.length > 0) {
        const kpHeader = document.createElement('h4');
        kpHeader.className = 'page-reader-header';
        kpHeader.textContent = api.getMessage('pageReaderKeyPointsHeader') || 'Key points';
        root.appendChild(kpHeader);

        const ul = document.createElement('ul');
        ul.className = 'page-reader-points';
        for (const point of digest.keyPoints) {
            const li = document.createElement('li');
            li.textContent = point;
            ul.appendChild(li);
        }
        root.appendChild(ul);
    }
}
