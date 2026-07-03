/**
 * Pulls the visible text of a tab's page so other code (hover summarize,
 * reading-list summary memory, page reader) can feed it to the AI layer.
 *
 * Extracted from hoverSummarizeManager so the same helper can be called
 * from multiple summarize entry points without re-implementing the
 * executeScript scrape.
 *
 * Extraction strategy: prefer semantic content containers (article / main /
 * [role="main"]) so newsletter/blog pages (e.g. Substack) yield the actual
 * post body instead of nav menus, subscribe boxes, and recommendation lists
 * that precede it in <body> — those used to crowd out the article within
 * the maxLen budget. Falls back to the whole cleaned <body> when no
 * container carries enough text.
 *
 * Returns null when:
 *   - the tab isn't scriptable (chrome://, chrome-extension://, store pages)
 *   - the page has effectively no text (< 20 chars)
 *
 * Truncates at `maxLen` chars (default 1500, tuned for Gemini Nano's input
 * budget; cloud providers pass a larger budget via aiManager.getInputCharBudget).
 */

const MIN_TEXT_LEN = 20;
const MAX_TEXT_LEN = 1500;

/**
 * @param {number} tabId
 * @param {{maxLen?: number}} [opts]
 * @returns {Promise<string|null>}
 */
export async function extractPageContent(tabId, { maxLen = MAX_TEXT_LEN } = {}) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const NOISE_SELECTOR = 'script, style, nav, footer, header, aside, [role="navigation"], [role="banner"]';
                const cleanText = (el) => {
                    const clone = el.cloneNode(true);
                    clone.querySelectorAll(NOISE_SELECTOR).forEach(n => n.remove());
                    return clone.innerText.replace(/\s+/g, ' ').trim();
                };

                // Prefer the semantic content container with the most text;
                // among multiple <article>s (comment threads etc.) pick the longest.
                const MIN_CONTAINER_TEXT = 200;
                const candidates = [
                    ...document.querySelectorAll('article'),
                    ...document.querySelectorAll('main, [role="main"]'),
                ];
                let best = '';
                for (const el of candidates) {
                    const text = cleanText(el);
                    if (text.length > best.length) best = text;
                    // Articles come first — a substantial one wins without
                    // falling through to the (larger) main wrapper.
                    if (el.tagName === 'ARTICLE' && text.length >= MIN_CONTAINER_TEXT) break;
                }
                if (best.length >= MIN_CONTAINER_TEXT) return best;

                // Fallback: whole cleaned body (previous behavior).
                return cleanText(document.body);
            }
        });

        const text = results?.[0]?.result || '';
        if (text.length < MIN_TEXT_LEN) return null;
        return text.substring(0, maxLen);
    } catch {
        return null;
    }
}
