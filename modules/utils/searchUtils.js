/**
 * @fileoverview Pure search helpers (no DOM, no chrome APIs).
 * Extracted from searchManager.js so they can be unit-tested in isolation.
 * @module searchUtils
 */

// 多關鍵字匹配檢查（OR 邏輯）
export function matchesAnyKeyword(text, keywords) {
    // 防禦性檢查：如果 keywords 不是陣列，轉換為陣列
    // 確保 keywords 始終是一個字串陣列
    let processedKeywords = [];
    if (Array.isArray(keywords)) {
        processedKeywords = keywords.filter(k => typeof k === 'string' && k.length > 0);
    } else if (typeof keywords === 'string') {
        processedKeywords = keywords.split(/\s+/).filter(k => k.length > 0);
    } else {
        // 如果 keywords 既不是陣列也不是字串，則視為沒有關鍵字，所有項目都匹配
        return true;
    }

    if (processedKeywords.length === 0) return true;
    const lowerText = text.toLowerCase();
    return processedKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// 從 URL 提取 domain
export function extractDomain(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        // 如果不是有效的 URL，嘗試用正則提取 domain
        const match = url.match(/^(?:https?:\/\/)?([^\/:?#]+)/);
        return match ? match[1] : '';
    }
}
