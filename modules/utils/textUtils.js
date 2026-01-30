/**
 * Text Utilities Module
 * Provides safe text manipulation functions.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param {string} text - The text to escape
 * @returns {string} The escaped HTML string
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escapes RegExp special characters.
 * @param {string} string - The string to escape
 * @returns {string} The escaped string
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights matches in text using HTML mark tags.
 * Safe against XSS as it escapes the text.
 * @param {string} text - The text to highlight
 * @param {RegExp[]} regexes - Array of regexes to match
 * @param {string} type - 'title' or 'url' to determine CSS class
 * @returns {string} The HTML string with highlights
 */
export function highlightText(text, regexes, type) {
    // 1. 收集所有匹配區間
    const matches = [];
    regexes.forEach(regex => {
        let match;
        const clonedRegex = new RegExp(regex.source, regex.flags);
        while ((match = clonedRegex.exec(text)) !== null) {
            matches.push({ start: match.index, end: match.index + match[0].length });
            // 防止無限迴圈 (當 regex 是 global 且匹配空字串時)
            if (match[0].length === 0) {
                clonedRegex.lastIndex++;
            }
        }
    });

    // 如果沒有匹配，直接返回轉義後的原始文字
    if (matches.length === 0) {
        return escapeHtml(text);
    }

    // 2. 合併重疊區間
    matches.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const m of matches) {
        if (merged.length === 0 || m.start > merged[merged.length - 1].end) {
            merged.push({ ...m });
        } else {
            merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, m.end);
        }
    }

    // 3. 組裝結果：先轉義文字，再插入 <mark> 標籤
    const markClass = type === 'url' ? 'url-match' : 'title-match';
    let result = '';
    let lastIndex = 0;
    for (const { start, end } of merged) {
        result += escapeHtml(text.slice(lastIndex, start));
        result += `<mark class="${markClass}">${escapeHtml(text.slice(start, end))}</mark>`;
        lastIndex = end;
    }
    result += escapeHtml(text.slice(lastIndex));

    return result;
}
