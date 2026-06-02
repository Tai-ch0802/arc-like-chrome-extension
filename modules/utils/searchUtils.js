/**
 * @fileoverview Pure search helpers (no DOM, no chrome APIs).
 * Extracted from searchManager.js so they can be unit-tested in isolation.
 * @module searchUtils
 */

// 多關鍵字匹配檢查（OR 邏輯）
export function matchesAnyKeyword(text, keywords) {
    // 型別防禦：非 string 時直接視為不匹配，避免 toLowerCase() 在
    // 未來新 caller 失誤時拋 TypeError 中斷 handleSearch。
    // 注意：現有 caller (tab.title / textContent / extractDomain) 都保證 string，
    // 這裡是對稱於 extractDomain 既有的 falsy 防禦，並非已知 bug 修補。
    if (typeof text !== 'string') return false;

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

/**
 * 將搜尋字串拆成一般關鍵字與 tag: 篩選。
 * 支援 tag:單詞 與 tag:"含空白名稱"；tag 名稱去引號、小寫化。其餘空白分隔詞為關鍵字（小寫）。
 * @param {string} query
 * @returns {{keywords: string[], tags: string[]}}
 */
export function parseSearchQuery(query) {
    const tags = [];
    if (typeof query !== 'string') return { keywords: [], tags };
    const rest = query.replace(/tag:"([^"]*)"|tag:(\S+)/gi, (_, quoted, bare) => {
        const name = (quoted !== undefined ? quoted : bare).trim().toLowerCase();
        if (name) tags.push(name);
        return ' ';
    });
    const keywords = rest.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    return { keywords, tags };
}

/**
 * 書籤是否含全部 required 標籤（AND、大小寫不敏感、精確名稱比對）。
 * @param {string[]} bookmarkTagNames 書籤目前的標籤名稱
 * @param {string[]} requiredTagNames 查詢要求的標籤名稱
 * @returns {boolean}
 */
export function bookmarkMatchesTags(bookmarkTagNames, requiredTagNames) {
    if (!requiredTagNames || requiredTagNames.length === 0) return true;
    const have = new Set((bookmarkTagNames || []).map(n => String(n).toLowerCase()));
    return requiredTagNames.every(req => have.has(String(req).toLowerCase()));
}

/**
 * 決定一次搜尋是否要過濾「面板各區塊」(分頁/群組/其他視窗/閱讀清單)。
 * 規則:出現任何 tag: token 時,搜尋只作用於書籤,其餘區塊應整批隱藏,
 * 故 filterPanelSections = false(由 caller 改走 hideNonBookmarkSections)。
 * keywords 目前未參與計算,保留以維持與 parseSearchQuery 回傳形狀的對稱性。
 * @param {{keywords?: string[], tags?: string[]}} [parsed]
 * @returns {{filterPanelSections: boolean}}
 */
export function searchScope({ keywords = [], tags = [] } = {}) {
    return { filterPanelSections: tags.length === 0 };
}
