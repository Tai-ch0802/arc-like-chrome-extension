/**
 * Natural-language search over tabs + bookmarks + reading list.
 *
 * Design: AI is a *reranker*, not a *filter*. We feed the model a capped
 * candidate list (top 30 by indexOf prefilter or random sample) and ask it
 * to pick up to 8 items most relevant to the user's free-form query, with
 * a short reason. This keeps token usage bounded and works on the local
 * Gemini Nano window.
 *
 * Triggered from Command Palette's "Ask AI: Find tabs/bookmarks" action,
 * which opens a prompt + result dialog independently of the main palette
 * flow. v1 keeps it out of the palette's incremental search to avoid
 * mixing the two interaction models (snappy indexOf vs. slow LLM).
 */
import * as api from '../apiManager.js';
import * as state from '../stateManager.js';
import * as aiManager from '../aiManager.js';
import * as modal from '../modalManager.js';
import * as readingListManager from '../readingListManager.js';
import { renderIcon } from '../icons.js';

const MAX_CANDIDATES = 30;
const MAX_RESULTS = 8;

/** Sanitize user-controlled strings so they can't break the prompt structure
 *  (newlines would let a malicious title pretend to be a new instruction).
 *  Cheap belt-and-suspenders — index validation downstream is the real guard.
 */
function sanitizeForPrompt(text) {
    if (typeof text !== 'string') return '';
    return text
        // Newlines/tabs -> space so a malicious title can't fake a prompt break.
        .replace(/[\r\n\t]/g, ' ')
        // Strip ASCII control chars (0x00-0x1F and 0x7F) that could hide injection.
        .replace(/[\x00-\x1F\x7F]/g, '')
        .slice(0, 120);
}

/** Reduce candidates to a query-relevant subset before sending to the model.
 *  Without this, "the first 30 by insertion order" gets sent, and a user with
 *  many tabs would never see their bookmarks/reading-list make the cut — the
 *  exact use case Ask-AI is supposed to serve.
 */
function preFilterByQuery(candidates, query) {
    if (!query) return candidates.slice(0, MAX_CANDIDATES);
    const q = query.toLowerCase();
    const scored = candidates.map(c => {
        const hay = ((c.title || '') + ' ' + (c.url || '')).toLowerCase();
        const idx = hay.indexOf(q);
        return { c, score: idx >= 0 ? idx : Number.MAX_SAFE_INTEGER };
    });
    scored.sort((a, b) => a.score - b.score);
    // Mixed strategy: prefer items that literally match the query; if fewer
    // than MAX_CANDIDATES match, fill the rest with the remaining items so
    // the model still has context for semantic matches the literal scan misses.
    return scored.slice(0, MAX_CANDIDATES).map(s => s.c);
}

/**
 * Builds a uniform candidate list across tabs / bookmarks / reading list.
 * Each candidate carries a `handler` so the result dialog can act on click.
 */
async function buildCandidates() {
    const out = [];

    const tabs = await chrome.tabs.query({}).catch(() => []);
    for (const t of tabs) {
        if (!t.url || /^chrome:/i.test(t.url)) continue;
        out.push({
            type: 'tab',
            title: t.title || '(untitled)',
            url: t.url,
            handler: async () => {
                await chrome.tabs.update(t.id, { active: true });
                await chrome.windows.update(t.windowId, { focused: true });
            },
        });
    }

    const bookmarks = (state.getBookmarkCache() || []).filter(b => b.type === 'bookmark');
    for (const b of bookmarks) {
        out.push({
            type: 'bookmark',
            title: b.title || '(untitled)',
            url: b.url,
            handler: () => chrome.tabs.create({ url: b.url }),
        });
    }

    try {
        const rl = await readingListManager.getAllEntries();
        for (const e of rl) {
            out.push({
                type: 'reading-list',
                title: e.title || '(untitled)',
                url: e.url,
                handler: () => chrome.tabs.create({ url: e.url }),
            });
        }
    } catch { /* reading list optional */ }

    return out;
}

/**
 * Calls the LanguageModel to rerank and pick up to MAX_RESULTS items.
 * Returns the original candidate objects (with handler intact) plus an
 * aiReason field.
 */
export async function askAiToFind(query) {
    if (!query || !query.trim()) return { unavailable: false, items: [] };

    const candidates = await buildCandidates();
    if (candidates.length === 0) return { unavailable: false, items: [] };

    // Pre-filter by query relevance BEFORE the 30-item cap. Without this, a
    // user with 30+ tabs would never see their bookmarks/reading-list make
    // it to the model — the exact use case Ask-AI is supposed to serve.
    const limited = preFilterByQuery(candidates, query.trim());
    const lines = limited
        .map((c, i) => `${i}. [${c.type}] ${sanitizeForPrompt(c.title)} — ${sanitizeForPrompt(c.url)}`)
        .join('\n');

    const prompt = `User wants to find items matching: "${sanitizeForPrompt(query)}"

Below is a numbered list of tabs, bookmarks, and reading-list entries. Choose up to ${MAX_RESULTS} items that best match the user's intent. Reply ONLY with a JSON array of {index, reason} where reason is at most 25 chars in the user's locale; no other text:
[
  { "index": 0, "reason": "short why" }
]

If nothing matches, reply with: []

[Items]
${lines}`;

    const raw = await aiManager.runPrompt(prompt);
    if (raw === null) return { unavailable: true, items: [] };

    try {
        const match = raw.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(match ? match[0] : raw);
        if (!Array.isArray(parsed)) return { unavailable: false, items: [] };
        const items = parsed
            .filter(p => typeof p.index === 'number' && limited[p.index])
            .map(p => ({
                ...limited[p.index],
                aiReason: typeof p.reason === 'string' ? p.reason.slice(0, 30) : '',
            }))
            // Hard-cap even if the model ignored "up to MAX_RESULTS" and returned more.
            .slice(0, MAX_RESULTS);
        return { unavailable: false, items };
    } catch {
        return { unavailable: false, items: [] };
    }
}

/**
 * Opens the Ask-AI prompt-and-results dialog flow.
 *
 * v1 uses sequential modals (prompt → results) instead of inline embedding
 * in the main palette to keep the snappy indexOf incremental search and
 * the slower LLM rerank cleanly separated.
 */
export async function openAskAiDialog() {
    const query = await modal.showPrompt({
        title: api.getMessage('cmdPaletteAskAiTitle') || 'Ask AI: find tabs or bookmarks',
        defaultValue: '',
    });
    if (!query || !query.trim()) return;

    const waiting = document.createElement('div');
    waiting.className = 'cmd-palette-empty';
    waiting.textContent = api.getMessage('cmdPaletteAskAiThinking') || 'Asking AI…';
    const close = await openResultsDialog(waiting);

    const { unavailable, items } = await askAiToFind(query.trim());
    // Replace placeholder content with results, in place.
    const root = waiting.parentElement;
    if (!root) return;
    root.innerHTML = '';

    if (unavailable) {
        const msg = document.createElement('div');
        msg.className = 'cmd-palette-empty';
        msg.textContent = api.getMessage('cmdPaletteAskAiUnavailable')
            || 'AI model is not downloaded yet. Trigger Smart Group first to download, then try again.';
        root.appendChild(msg);
        return;
    }

    if (items.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'cmd-palette-empty';
        msg.textContent = api.getMessage('cmdPaletteAskAiNoMatch') || 'AI found no good matches.';
        root.appendChild(msg);
        return;
    }

    for (const item of items) {
        const row = document.createElement('div');
        row.className = 'cmd-palette-row';
        row.setAttribute('role', 'button');
        row.tabIndex = 0;

        const icon = document.createElement('span');
        icon.className = 'cmd-palette-icon';
        icon.innerHTML = renderIcon(
            item.type === 'tab' ? 'language' : item.type === 'bookmark' ? 'bookmark' : 'menu_book',
            { size: 16 }
        );

        const meta = document.createElement('div');
        meta.className = 'cmd-palette-meta';

        const title = document.createElement('div');
        title.className = 'cmd-palette-title';
        title.textContent = item.title;

        const sub = document.createElement('div');
        sub.className = 'cmd-palette-subtitle';
        sub.textContent = item.aiReason ? `${item.aiReason} — ${item.url}` : item.url;

        meta.appendChild(title);
        meta.appendChild(sub);
        row.appendChild(icon);
        row.appendChild(meta);

        const trigger = async () => {
            try {
                close();
                await item.handler();
            } catch (err) {
                console.warn('[nlSearch] action failed:', err);
            }
        };
        row.addEventListener('click', trigger);
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); trigger(); }
        });
        root.appendChild(row);
    }
}

/**
 * Wraps modal.showCustomDialog with an explicit `close()` so handlers can
 * close from outside the modal (e.g., after a result row is clicked).
 *
 * Uses the onOpen callback to capture THIS dialog's overlay element so
 * close() targets the right modal even when another dialog stacks on top.
 * (`document.querySelector('.modal-overlay')` would grab whichever overlay
 * is first in the DOM, which is wrong as soon as anything else stacks.)
 */
function openResultsDialog(initialContent) {
    return new Promise((resolveClose) => {
        const container = document.createElement('div');
        container.className = 'cmd-palette-results';
        container.style.maxHeight = '60vh';
        container.style.overflowY = 'auto';
        container.appendChild(initialContent);

        let overlayRef = null;
        const close = () => {
            // Close this specific overlay by clicking its own #closeButton.
            overlayRef?.querySelector('#closeButton')?.click();
        };

        modal.showCustomDialog({
            title: api.getMessage('cmdPaletteAskAiResultsTitle') || 'AI suggestions',
            content: container,
            onOpen: (modalContent) => {
                overlayRef = modalContent.closest('.modal-overlay');
                resolveClose(close);
            },
        });
    });
}
