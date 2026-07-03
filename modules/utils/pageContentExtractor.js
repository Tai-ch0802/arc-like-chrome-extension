/**
 * Pulls the visible text of a tab's page so other code (hover summarize,
 * reading-list summary memory) can feed it to the Summarizer API.
 *
 * Extracted from hoverSummarizeManager so the same helper can be called
 * from multiple summarize entry points without re-implementing the
 * executeScript scrape.
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
                const clone = document.body.cloneNode(true);
                clone.querySelectorAll('script, style, nav, footer, header, aside, [role="navigation"], [role="banner"]')
                    .forEach(el => el.remove());
                return clone.innerText.replace(/\s+/g, ' ').trim();
            }
        });

        const text = results?.[0]?.result || '';
        if (text.length < MIN_TEXT_LEN) return null;
        return text.substring(0, maxLen);
    } catch {
        return null;
    }
}
