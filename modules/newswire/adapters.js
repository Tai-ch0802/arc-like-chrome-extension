// newswire 來源 adapters (BASE-016 N1:Tree of Alpha;FJ/Alpaca/金十 於 N2)。
// SW 專用:直接使用 WebSocket / setTimeout(RULE_002 的 SW 專屬邏輯例外)。
// 每源獨立重連狀態機:指數退避＋抖動(上限 60s),連續失敗達 10 次標記
// degraded(仍以上限間隔續試,不放棄)。協定紀律:僅送各源官方文件定義的
// 訊息(Tree 僅選填的 `login <key>` 純文字認證,無 app-level 心跳)。

export const TREE_WS_URL = 'wss://news.treeofalpha.com/ws';
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
 * Tree of Alpha 主 WS。免 key 可連;有 key 時連線後送純文字 `login <key>`
 * 去延遲(官方範例作法)。連線初始的 history replay 與即時訊息同走 onRaw,
 * 重複由管線 L1 去重吸收。
 * @param {{apiKey?: string}} cfg
 * @param {{onRaw?: (raw:any)=>void, onStatus?: (s:string)=>void}} hooks
 * @returns {{connect:Function, disconnect:Function, isAlive:Function}}
 */
export function createTreeAdapter(cfg = {}, hooks = {}) {
    const { apiKey } = cfg;
    const onRaw = hooks.onRaw || (() => {});
    const onStatus = hooks.onStatus || (() => {});
    let ws = null;
    let attempts = 0;
    let reconnectTimer = null;
    let stopped = false;

    const isAlive = () => !!ws && ws.readyState === WebSocket.OPEN;

    function scheduleReconnect() {
        if (stopped || reconnectTimer) return;
        attempts += 1;
        onStatus(attempts >= DEGRADED_AFTER_FAILS ? 'degraded' : 'retrying');
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            open();
        }, computeBackoffMs(attempts));
    }

    function open() {
        if (stopped) return;
        onStatus('connecting');
        try {
            ws = new WebSocket(TREE_WS_URL);
        } catch (err) {
            ws = null;
            scheduleReconnect();
            return;
        }
        ws.onopen = () => {
            attempts = 0;
            if (apiKey) {
                try { ws.send(`login ${apiKey}`); } catch { /* 連線剛斷,交給 onclose */ }
            }
            onStatus('connected');
        };
        ws.onmessage = (e) => onRaw(e.data);
        // onerror 之後必有 onclose;重連統一在 onclose 排程,避免雙重排程。
        ws.onerror = () => {};
        ws.onclose = () => {
            ws = null;
            if (!stopped) scheduleReconnect();
        };
    }

    return {
        connect() {
            stopped = false;
            if (!isAlive() && !reconnectTimer) open();
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
