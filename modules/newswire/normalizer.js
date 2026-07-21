// newswire normalizer (BASE-016 N1).
// 純函式:各源 raw payload → 統一 NewsEvent。零 chrome/DOM 依賴(SW 無
// DOMParser,strip HTML 一律 regex;渲染端 textContent 為第二道防線)。
//
// NewsEvent 形狀見 SA §4.1:
//   { id:`${source}:${sourceId}`, source, sourceId, tsSource, tsIngest,
//     title, url?, symbols?, srcImportant }
// importance 由 rules.classify 於管線後段決定,不在此附加。

export const NEWSWIRE_SOURCES = ['tree', 'fj', 'alpaca', 'jin10'];

const TITLE_MAX = 500;
const URL_MAX = 2048;
const SYMBOLS_MAX = 20;

/** 移除 HTML 標籤(金十 content 為富文本;Tree 偶帶 entity)。 */
export function stripHtml(s) {
    return String(s).replace(/<[^>]*>/g, ' ');
}

function collapseWhitespace(s) {
    return s.replace(/\s+/g, ' ').trim();
}

/** djb2:來源缺唯一 id 時以內容雜湊補 sourceId(去重鍵仍然穩定)。 */
export function hashString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

/**
 * 共用淨化:欄位裁剪/長度上限/URL scheme 白名單。回 null 表示丟棄。
 * @param {object} partial {source, sourceId?, title, url?, tsSource?, symbols?, srcImportant?}
 * @param {number} [now] 注入時間(測試用;預設 Date.now())
 * @returns {object|null} NewsEvent
 */
export function sanitizeEvent(partial, now = Date.now()) {
    if (!partial || !NEWSWIRE_SOURCES.includes(partial.source)) return null;
    const title = collapseWhitespace(stripHtml(partial.title ?? ''))
        .normalize('NFKC')
        .slice(0, TITLE_MAX);
    if (!title) return null;

    const sourceId = String(partial.sourceId ?? '').trim()
        || hashString(`${title}:${partial.tsSource ?? ''}`);

    let url;
    if (partial.url != null) {
        try {
            const u = new URL(String(partial.url));
            // 前綴比對可被 javascript: 變體繞過,一律走 URL parser 驗證 scheme。
            if ((u.protocol === 'http:' || u.protocol === 'https:') && u.href.length <= URL_MAX) {
                url = u.href;
            }
        } catch { /* 非法 URL → 略去欄位,事件仍保留 */ }
    }

    const tsSource = (Number.isFinite(partial.tsSource) && partial.tsSource > 0)
        ? Math.floor(partial.tsSource)
        : now;

    let symbols;
    if (Array.isArray(partial.symbols)) {
        symbols = partial.symbols
            .filter((s) => typeof s === 'string' && s.trim())
            .map((s) => s.trim().toUpperCase().slice(0, 16))
            .slice(0, SYMBOLS_MAX);
        if (!symbols.length) symbols = undefined;
    }

    return {
        id: `${partial.source}:${sourceId}`,
        source: partial.source,
        sourceId,
        tsSource,
        tsIngest: now,
        title,
        ...(url ? { url } : {}),
        ...(symbols ? { symbols } : {}),
        srcImportant: partial.srcImportant === true,
    };
}

function toObject(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
}

/**
 * 金十 `time` 為北京時間(UTC+8)字串「YYYY-MM-DD HH:mm:ss」,轉 epoch ms。
 * @returns {number|undefined} 無法解析回 undefined(sanitize 會 fallback ingest)
 */
export function parseBeijingTime(s) {
    if (typeof s !== 'string') return undefined;
    const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
    if (!m) return undefined;
    const ts = Date.parse(`${m[1]}T${m[2]}+08:00`);
    return Number.isFinite(ts) ? ts : undefined;
}

/**
 * Tree of Alpha 主 WS:訊息為 JSON(單則或批次;連線初始有 history replay,
 * 與即時訊息同路徑,重複靠 L1 去重)。常見欄位 _id/title/body/url/link/
 * time(epoch ms)/symbols 或 suggestions[].coin。欄位以實測 payload 為準,
 * 全部防禦性讀取;解析失敗回 []。
 * @param {unknown} raw ws message data(字串或已解析物件)
 * @returns {object[]} NewsEvent[]
 */
export function parseTree(raw, now = Date.now()) {
    const msg = toObject(raw);
    if (msg == null) return [];
    const items = Array.isArray(msg) ? msg : [msg];
    const out = [];
    for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const symbols = Array.isArray(it.symbols)
            ? it.symbols
            : (Array.isArray(it.suggestions)
                ? it.suggestions.map((s) => s && s.coin).filter(Boolean)
                : undefined);
        const ev = sanitizeEvent({
            source: 'tree',
            sourceId: it._id ?? it.id,
            title: it.title || it.body || '',
            url: it.url ?? it.link,
            tsSource: typeof it.time === 'number' ? it.time : undefined,
            symbols,
        }, now);
        if (ev) out.push(ev);
    }
    return out;
}

/**
 * FinancialJuice Stream:訊息 `{type:'news'|'calendar', data:{...}}`,
 * v1 只取 news(日曆留未來功能)。欄位以實測 payload 校正(M0 註記):
 * headline/time 防禦性讀取。
 * @returns {object[]} NewsEvent[]
 */
export function parseFj(raw, now = Date.now()) {
    const msg = toObject(raw);
    if (msg == null || msg.type !== 'news') return [];
    const items = Array.isArray(msg.data) ? msg.data : (msg.data ? [msg.data] : []);
    const out = [];
    for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const parsedTime = typeof it.time === 'number' ? it.time : Date.parse(it.time);
        const ev = sanitizeEvent({
            source: 'fj',
            sourceId: it.id ?? it.newsId,
            title: it.headline || it.title || '',
            url: it.url ?? it.link,
            tsSource: Number.isFinite(parsedTime) ? parsedTime : undefined,
        }, now);
        if (ev) out.push(ev);
    }
    return out;
}

/**
 * Alpaca News Stream:訊息為陣列,資料項 `T === 'n'`
 * ({id, headline, created_at, url, symbols});控制訊息(success/error/
 * subscription)由 adapter 處理,這裡直接略過。
 * @returns {object[]} NewsEvent[]
 */
export function parseAlpaca(raw, now = Date.now()) {
    const msg = toObject(raw);
    if (msg == null) return [];
    const items = Array.isArray(msg) ? msg : [msg];
    const out = [];
    for (const it of items) {
        if (!it || typeof it !== 'object' || it.T !== 'n') continue;
        const parsedTime = Date.parse(it.created_at);
        const ev = sanitizeEvent({
            source: 'alpaca',
            sourceId: it.id,
            title: it.headline || '',
            url: it.url,
            tsSource: Number.isFinite(parsedTime) ? parsedTime : undefined,
            symbols: it.symbols,
        }, now);
        if (ev) out.push(ev);
    }
    return out;
}

/**
 * 金十官方 WSS(M0 定稿,SA §5.4):資料訊息
 * `{type:'data', data:{id, time(北京時間), important, data:{content(富文本),
 * title}, action:1新增|2修改|3刪除}}`。v1 只處理 action===1(缺 action 視為
 * 新增);content 可含 HTML,由 sanitizeEvent 統一 strip;important===1 →
 * srcImportant(rules 據此強制 P0)。
 * @param {unknown} raw ws 訊息(字串或已解析物件;adapter 已剝殼則為 data 訊息本體)
 * @returns {object[]} NewsEvent[]
 */
export function parseJin10(raw, now = Date.now()) {
    const msg = toObject(raw);
    if (msg == null || msg.type !== 'data') return [];
    const d = msg.data;
    if (!d || typeof d !== 'object') return [];
    if (d.action != null && d.action !== 1) return []; // 修改/刪除 v1 忽略
    const inner = d.data || {};
    const ev = sanitizeEvent({
        source: 'jin10',
        sourceId: d.id,
        title: inner.title || inner.content || '',
        url: inner.source_link || inner.link,
        tsSource: parseBeijingTime(d.time),
        srcImportant: d.important === 1,
    }, now);
    return ev ? [ev] : [];
}
