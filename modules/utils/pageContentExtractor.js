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
 * Truncates at 1500 chars to stay under Gemini Nano's input budget.
 */

const MIN_TEXT_LEN = 20;
const MAX_TEXT_LEN = 1500;

/**
 * @param {number} tabId
 * @returns {Promise<string|null>}
 */
export async function extractPageContent(tabId) {
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
        return text.substring(0, MAX_TEXT_LEN);
    } catch {
        return null;
    }
}
