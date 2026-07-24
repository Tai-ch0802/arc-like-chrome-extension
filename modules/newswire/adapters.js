// newswire 來源 adapters (BASE-016;N1 Tree、N2 加入 FJ/Alpaca/金十)。
// SW 專用:直接使用 WebSocket / setTimeout(RULE_002 的 SW 專屬邏輯例外)。
//
// 共用 harness `createWsAdapter`:每源獨立重連狀態機——指數退避＋抖動
// (上限 60s),連續失敗達 10 次標記 degraded(仍以上限間隔續試);
// `ctx.fail()` 用於憑證類錯誤(auth 被拒),停止重試等設定變更重建,
// 避免拿錯誤的 key 打爆對方。協定紀律:僅送各源官方文件定義的訊息,
// 一律不送未定義的 app-level 心跳。

export const TREE_WS_URL = 'wss://news.treeofalpha.com/ws';
export const FJ_WS_URL = 'wss://stream.financialjuice.com/v1/stream';
export const ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v1beta1/news';
export const JIN10_WS_URL = 'wss://open-api-ws.jin10.com/flash';

export const MAX_BACKOFF_MS = 60000;
export const DEGRADED_AFTER_FAILS = 10;

/**
 * 純函式:第 attempt 次重連的延遲(SA §5.1:min(60s, 1s·2^attempt)＋抖動)。
 * @param {number} attempt 1 起算
 * @param {number} [rand] 0~1(注入以利測試)
 */
export function computeBackoffMs(attempt, rand = Math.random()) {
    const exp = Math.min(Math.max(attempt, 1), 10); // 2^10 已超過上限,夾住防溢位
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** exp);
    return base + Math.floor(rand * 1000);
}

/**
 * 純函式:該來源啟用所需的憑證是否缺漏(缺→feedManager 顯示 needs-key
 * 且不建連線)。Tree 免 key。
 * @param {'tree'|'fj'|'alpaca'|'jin10'} source
 * @param {object} keys newswireKeys 形狀
 */
export function missingCreds(source, keys) {
    switch (source) {
        case 'tree': return false;
        case 'fj': return !keys?.fj?.apiKey;
        case 'alpaca': return !(keys?.alpaca?.keyId && keys?.alpaca?.secret);
        case 'jin10': return !keys?.jin10?.secretKey;
        // Telegram(BASE-018):需 session（登入後產出）＋ api_id/api_hash。
        case 'tg': return !(keys?.tg?.session && keys?.tg?.apiId && keys?.tg?.apiHash);
        default: return true;
    }
}

/**
 * 純函式:Telegram 已登入(creds 齊)但**未設定任何頻道**。訂閱空頻道 whitelist 時
 * teleproto 的 EventBuilder filter 會靜默丟棄每一則訊息(events/common.js:89-98)卻報
 * connected → 使用者以為正常卻收不到。feedManager 據此改報 needs-config、不建連線,
 * 待使用者加頻道(config 變更)後重建。其他源無頻道概念,一律 false。
 * @param {string} source
 * @param {object} sourceCfg config.sources[source]
 */
export function missingChannels(source, sourceCfg) {
    return source === 'tg' && !(sourceCfg?.channels?.length);
}

/**
 * 純函式:金十 subscribe params(SA §5.4)。category 空值 fallback ['1'];
 * language 僅在 traditional 時送出;contain/filter/classify v1 不使用
 * (mute/分級統一走 client 端 rules,跨源一致)。
 */
export function buildJin10SubscribeParams(cfg = {}) {
    const cats = (Array.isArray(cfg.categories) ? cfg.categories : [])
        .map((c) => String(c).trim())
        .filter(Boolean);
    const params = { category: cats.length ? cats : ['1'] };
    if (cfg.language === 'traditional') params.language = 'traditional';
    return params;
}

/**
 * 共用 WS 生命週期 harness。
 * @param {object} spec
 * @param {string} spec.name 來源名(除錯用)
 * @param {() => (string|null)} spec.buildUrl 回 null 表示憑證不足(needs-key)
 * @param {(ctx) => void} [spec.onOpen] 連線後握手(認證等)
 * @param {(raw, ctx) => void} spec.handleMessage
 * @param {boolean} [spec.connectedOnOpen=true] false=由 handleMessage 於
 *        訂閱/認證完成後自行 ctx.setStatus('connected')(Alpaca/金十)
 * @param {{onRaw?:Function, onStatus?:Function}} hooks
 * @returns {{connect:Function, disconnect:Function, isAlive:Function}}
 */
export function createWsAdapter(spec, hooks = {}) {
    const onRaw = hooks.onRaw || (() => {});
    const onStatus = hooks.onStatus || (() => {});
    let ws = null;
    let attempts = 0;
    let reconnectTimer = null;
    let stopped = false;
    let failed = false; // 憑證類終止:不再重試,等 config 變更重建 adapter

    const isAlive = () => !!ws && ws.readyState === WebSocket.OPEN;

    const ctx = {
        emit: (raw) => onRaw(raw),
        setStatus: (s) => onStatus(s),
        send(payload) {
            try {
                ws?.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
            } catch { /* 連線剛斷:交給 onclose 重連 */ }
        },
        fail(status) {
            failed = true;
            onStatus(status);
            try { ws?.close(); } catch { /* already closing */ }
        },
    };

    function scheduleReconnect() {
        if (stopped || failed || reconnectTimer) return;
        attempts += 1;
        onStatus(attempts >= DEGRADED_AFTER_FAILS ? 'degraded' : 'retrying');
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            open();
        }, computeBackoffMs(attempts));
    }

    function open() {
        if (stopped || failed) return;
        const url = spec.buildUrl();
        if (!url) {
            failed = true;
            onStatus('needs-key');
            return;
        }
        onStatus('connecting');
        try {
            ws = new WebSocket(url);
        } catch {
            ws = null;
            scheduleReconnect();
            return;
        }
        ws.onopen = () => {
            attempts = 0;
            spec.onOpen?.(ctx);
            if (spec.connectedOnOpen !== false) onStatus('connected');
        };
        ws.onmessage = (e) => spec.handleMessage(e.data, ctx);
        // onerror 之後必有 onclose;重連統一在 onclose 排程,避免雙重排程。
        ws.onerror = () => {};
        ws.onclose = () => {
            ws = null;
            if (!stopped && !failed) scheduleReconnect();
        };
    }

    return {
        connect() {
            stopped = false;
            if (!failed && !isAlive() && !reconnectTimer) open();
        },
        disconnect() {
            stopped = true;
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            attempts = 0;
            if (ws) {
                try { ws.close(); } catch { /* already closing */ }
                ws = null;
            }
            onStatus('disabled');
        },
        isAlive,
    };
}

/**
 * Tree of Alpha 主 WS。免 key 可連;有 key 時連線後送純文字 `login <key>`
 * 去延遲(官方範例作法)。連線初始 history replay 與即時訊息同走 onRaw,
 * 重複由管線 L1 去重吸收。
 */
export function createTreeAdapter(cfg = {}, hooks = {}) {
    return createWsAdapter({
        name: 'tree',
        buildUrl: () => TREE_WS_URL,
        onOpen: (ctx) => {
            if (cfg.apiKey) ctx.send(`login ${cfg.apiKey}`);
        },
        handleMessage: (raw, ctx) => ctx.emit(raw),
    }, hooks);
}

/**
 * FinancialJuice Stream:key 走 query string(該源官方設計;僅於 SW 內組
 * URL,不落 log)。連線即推送,無 subscribe 訊框。
 *
 * 已知限制:FJ 協定沒有可辨識的「認證失敗」訊框(不像 Alpaca 的 error code
 * 或金十的 auth_result),因此無效 key 只會表現為伺服器關閉連線 → 一般退避
 * 重連(上限 60s,不會風暴,但不會像其他兩源那樣終止於 needs-key)。缺 key
 * 時 buildUrl 回 null,仍會在連線前就標記 needs-key。
 */
export function createFjAdapter(cfg = {}, hooks = {}) {
    return createWsAdapter({
        name: 'fj',
        buildUrl: () => (cfg.apiKey
            ? `${FJ_WS_URL}?apikey=${encodeURIComponent(cfg.apiKey)}`
            : null),
        handleMessage: (raw, ctx) => ctx.emit(raw),
    }, hooks);
}

/**
 * Alpaca 官方 error code 中屬於「憑證/方案問題,重試無用」的白名單:
 * 401 not authenticated、402 auth failed、409 insufficient subscription。
 * 其餘(400 語法、405 symbol limit、407 slow client、500 internal…)一律
 * 視為暫時性,交給一般重連——避免一次偶發錯誤讓來源永久卡在 needs-key。
 */
export const ALPACA_FATAL_AUTH_CODES = new Set([401, 402, 409]);

/**
 * Alpaca News:連線後 10 秒內送 auth,authenticated 後 subscribe news:["*"]。
 * 一般帳戶限 1 條同時連線——超限回 error 406(顯示 degraded,交給退避慢速
 * 續試,另一端釋放後可自癒);憑證類錯誤(見 ALPACA_FATAL_AUTH_CODES)
 * → needs-key 終止重試,等使用者改 key 觸發重建。
 */
export function createAlpacaAdapter(cfg = {}, hooks = {}) {
    return createWsAdapter({
        name: 'alpaca',
        connectedOnOpen: false,
        buildUrl: () => ((cfg.keyId && cfg.secret) ? ALPACA_WS_URL : null),
        onOpen: (ctx) => ctx.send({ action: 'auth', key: cfg.keyId, secret: cfg.secret }),
        handleMessage: (raw, ctx) => {
            let msgs;
            try { msgs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
            if (!Array.isArray(msgs)) msgs = [msgs];
            for (const m of msgs) {
                if (!m || typeof m !== 'object') continue;
                if (m.T === 'success' && m.msg === 'authenticated') {
                    ctx.send({ action: 'subscribe', news: ['*'] });
                } else if (m.T === 'subscription') {
                    ctx.setStatus('connected');
                } else if (m.T === 'error') {
                    if (ALPACA_FATAL_AUTH_CODES.has(m.code)) {
                        ctx.fail('needs-key'); // 憑證/方案問題:重試無用
                    } else {
                        // 406(連線數超限)與其餘未知碼:暫時性,標 degraded 後
                        // 交給 onclose→退避重連自癒,不永久終止。
                        ctx.setStatus('degraded');
                    }
                }
            }
            ctx.emit(raw); // 資料項(T==='n')由 parseAlpaca 過濾
        },
    }, hooks);
}

/**
 * 金十官方 WSS(SA §5.4,M0 定稿):三步 connect→auth(secret-key)→
 * subscribe(category[]/language)。auth 被拒 → needs-key 終止重試
 * (不打 auth 迴圈);subscribe 被拒 → degraded 終止(參數固定,重試無益,
 * 等設定變更重建)。資料訊息以已解析物件 emit,由 parseJin10 消化。
 * @param {{secretKey?:string, categories?:string[], language?:string}} cfg
 */
export function createJin10Adapter(cfg = {}, hooks = {}) {
    return createWsAdapter({
        name: 'jin10',
        connectedOnOpen: false,
        buildUrl: () => (cfg.secretKey ? JIN10_WS_URL : null),
        handleMessage: (raw, ctx) => {
            let msg;
            try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
            const type = msg?.type;
            if (type === 'connected_result') {
                ctx.send({ action: 'auth', params: { 'secret-key': cfg.secretKey } });
            } else if (type === 'auth_result') {
                if (msg?.data?.auth_result === 200) {
                    ctx.send({ action: 'subscribe', params: buildJin10SubscribeParams(cfg) });
                } else {
                    ctx.fail('needs-key');
                }
            } else if (type === 'subscribe_result') {
                if (msg?.data?.subscribe_result === 200) ctx.setStatus('connected');
                else ctx.fail('degraded');
            } else if (type === 'data') {
                ctx.emit(msg);
            }
        },
    }, hooks);
}
