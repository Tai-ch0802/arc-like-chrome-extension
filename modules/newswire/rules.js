// newswire 規則引擎 (BASE-016 N1)。
// 純函式:關鍵字 → P0/P1/P2 分級與靜音。比對前 NFKC + lowercase
// (跨全形/半形與大小寫;簡繁不互通,預設集兩種寫法並列)。
// 預設關鍵字集沿上游規格書 §6(台股/台指期語境)。

export const DEFAULT_RULES = {
    p0: [
        'FOMC', 'rate decision', 'CPI', 'Non-Farm', 'NFP', 'PCE',
        '利率決議', '利率决议', '非農', '非农', '消費者物價', '消费者物价',
    ],
    p1: [
        'TSMC', '台積電', '台积电', 'TSM', 'NVDA', 'Nvidia',
        'semiconductor', '半導體', '半导体', 'chip',
        'tariff', '關稅', '关税', 'Taiwan', '台灣', '台湾',
        'BOJ', '日銀', '日银', 'yen', '日圓', '日圆',
        'HBM', 'DDR5', 'ABF', 'CoWoS',
    ],
    mute: ['crypto airdrop', 'NFT mint'],
};

export function normalizeForMatch(s) {
    return String(s).normalize('NFKC').toLowerCase();
}

function hitAny(normalizedTitle, words) {
    if (!Array.isArray(words)) return false;
    return words.some((w) => {
        const n = normalizeForMatch(w).trim();
        return n && normalizedTitle.includes(n);
    });
}

/**
 * 分級:mute 命中 → 丟棄;來源標記高重要度(srcImportant,如金十
 * important===1)或命中 P0 詞 → 0;P1 詞 → 1;其餘 → 2。
 * @param {object} event NewsEvent
 * @param {{p0?:string[],p1?:string[],mute?:string[]}} [rules]
 * @returns {{importance:0|1|2, muted:boolean}}
 */
export function classify(event, rules = DEFAULT_RULES) {
    const title = normalizeForMatch(event?.title || '');
    const r = rules || DEFAULT_RULES;
    if (hitAny(title, r.mute)) return { importance: 2, muted: true };
    if (event?.srcImportant === true || hitAny(title, r.p0)) return { importance: 0, muted: false };
    if (hitAny(title, r.p1)) return { importance: 1, muted: false };
    return { importance: 2, muted: false };
}
