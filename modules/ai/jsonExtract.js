/**
 * JSON extraction helpers for model text output.
 *
 * LLMs are asked to reply with strict JSON, but real-world output often
 * carries markdown code fences, leading prose, or trailing commentary.
 * These helpers centralize the tolerant-extraction logic that used to be
 * duplicated as inline regexes in aiManager and nlSearch.
 */

/**
 * Removes markdown code fences (``` / ```json) the model may emit.
 * Only strips fences on their own line or hugging the payload's edges, so
 * backtick runs INSIDE JSON string values survive intact.
 */
function stripCodeFences(raw) {
    return raw
        .replace(/^\s*```(?:json)?\s*$/gim, '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
}

function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return undefined;
    }
}

/**
 * Extracts the first JSON array found in a blob of model text.
 * @param {string} raw - Raw model output.
 * @returns {any[]|null} The parsed array (possibly empty), or null.
 */
export function extractJsonArray(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const text = stripCodeFences(raw).trim();

    const direct = tryParse(text);
    if (Array.isArray(direct)) return direct;

    // Greedy first: captures multi-object arrays with nested brackets.
    const greedy = text.match(/\[[\s\S]*\]/);
    if (greedy) {
        const parsed = tryParse(greedy[0]);
        if (Array.isArray(parsed)) return parsed;
    }

    // Lazy fallback: greedy can over-capture when unrelated brackets trail
    // the JSON (e.g. "…] see [source]"), so retry with the shortest span.
    const lazy = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (lazy) {
        const parsed = tryParse(lazy[0]);
        if (Array.isArray(parsed)) return parsed;
    }

    return null;
}

/**
 * Extracts the first JSON object found in a blob of model text.
 * @param {string} raw - Raw model output.
 * @returns {object|null} The parsed object, or null.
 */
export function extractJsonObject(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const text = stripCodeFences(raw).trim();

    const direct = tryParse(text);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;

    const greedy = text.match(/\{[\s\S]*\}/);
    if (greedy) {
        const parsed = tryParse(greedy[0]);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }

    const lazy = text.match(/\{[\s\S]*?\}/);
    if (lazy) {
        const parsed = tryParse(lazy[0]);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }

    return null;
}
