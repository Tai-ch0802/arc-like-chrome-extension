/**
 * createWsAdapter 狀態機測試(BASE-016,回應 PR #191 review)。
 *
 * 這層是整個 newswire 對「不違反來源單連線限制」最關鍵的邏輯,先前只有
 * computeBackoffMs 等純函式被覆蓋。這裡用 fake WebSocket + fake timers 驅動
 * 完整生命週期:握手、狀態轉移、ctx.fail() 終止語義、退避重連、watchdog
 * 重複 connect() 不產生重複連線。
 */
import {
    createWsAdapter,
    createTreeAdapter,
    createFjAdapter,
    createAlpacaAdapter,
    createJin10Adapter,
    ALPACA_FATAL_AUTH_CODES,
    TREE_WS_URL,
    JIN10_WS_URL,
} from '../../modules/newswire/adapters.js';

/** 最小 fake WebSocket:記錄實例與送出的訊息,手動觸發事件。 */
class FakeWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    static instances = [];

    constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        this.closed = false;
        FakeWebSocket.instances.push(this);
    }

    send(data) { this.sent.push(data); }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.();
    }

    // --- 測試驅動用 ---
    fireOpen() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(); }
    fireMessage(data) { this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }); }
    fireClose() { this.readyState = FakeWebSocket.CLOSED; this.onclose?.(); }
}

const lastWs = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
const wsCount = () => FakeWebSocket.instances.length;

function makeHooks() {
    const raws = [];
    const statuses = [];
    return {
        raws,
        statuses,
        hooks: { onRaw: (r) => raws.push(r), onStatus: (s) => statuses.push(s) },
        last: () => statuses[statuses.length - 1],
    };
}

beforeEach(() => {
    FakeWebSocket.instances = [];
    global.WebSocket = FakeWebSocket;
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
    delete global.WebSocket;
});

describe('createWsAdapter — lifecycle & reconnect', () => {
    const spec = (over = {}) => ({
        name: 'test',
        buildUrl: () => 'wss://example.test/ws',
        handleMessage: (raw, ctx) => ctx.emit(raw),
        ...over,
    });

    it('connect opens a socket and reports connected on open', () => {
        const { hooks, statuses } = makeHooks();
        const a = createWsAdapter(spec(), hooks);
        a.connect();
        expect(wsCount()).toBe(1);
        expect(statuses).toContain('connecting');
        lastWs().fireOpen();
        expect(statuses).toContain('connected');
        expect(a.isAlive()).toBe(true);
    });

    it('missing credentials (buildUrl → null) reports needs-key and opens NO socket', () => {
        const { hooks, statuses } = makeHooks();
        const a = createWsAdapter(spec({ buildUrl: () => null }), hooks);
        a.connect();
        expect(wsCount()).toBe(0);
        expect(statuses).toEqual(['needs-key']);
        a.connect(); // 再次呼叫(watchdog)仍不應連線
        expect(wsCount()).toBe(0);
    });

    it('reconnects with exponential backoff after an unexpected close', () => {
        const { hooks, statuses } = makeHooks();
        const a = createWsAdapter(spec(), hooks);
        a.connect();
        lastWs().fireOpen();
        lastWs().fireClose();
        expect(statuses).toContain('retrying');
        expect(wsCount()).toBe(1);      // 尚未重連
        jest.advanceTimersByTime(1999); // 第一次退避 ≥2s
        expect(wsCount()).toBe(1);
        jest.advanceTimersByTime(1500);
        expect(wsCount()).toBe(2);      // 已重連
    });

    it('marks degraded after 10 consecutive failures but keeps retrying', () => {
        const { hooks, statuses } = makeHooks();
        const a = createWsAdapter(spec(), hooks);
        a.connect();
        for (let i = 0; i < 10; i++) {
            lastWs().fireClose();
            jest.advanceTimersByTime(61000); // 超過退避上限,確保觸發
        }
        expect(statuses).toContain('degraded');
        expect(wsCount()).toBeGreaterThan(10); // 仍持續重連,未放棄
    });

    it('ctx.fail() stops retrying: no reconnect timer, connect() becomes a no-op', () => {
        const { hooks, statuses } = makeHooks();
        const a = createWsAdapter(spec({
            handleMessage: (raw, ctx) => ctx.fail('needs-key'),
        }), hooks);
        a.connect();
        lastWs().fireOpen();
        lastWs().fireMessage('{"any":"msg"}'); // → ctx.fail()
        expect(statuses).toContain('needs-key');

        const before = wsCount();
        jest.advanceTimersByTime(120000);
        expect(wsCount()).toBe(before);  // fail 後不排程重連
        a.connect();                     // watchdog 重複呼叫
        expect(wsCount()).toBe(before);  // 仍 no-op,等設定變更重建 adapter
    });

    it('watchdog-style repeated connect() during backoff does not create duplicate sockets', () => {
        const { hooks } = makeHooks();
        const a = createWsAdapter(spec(), hooks);
        a.connect();
        lastWs().fireClose();            // 進入退避
        a.connect();
        a.connect();
        expect(wsCount()).toBe(1);       // 退避中不重複開
        jest.advanceTimersByTime(61000);
        expect(wsCount()).toBe(2);       // 只由 timer 重連一次
    });

    it('disconnect closes the socket, cancels backoff and reports disabled', () => {
        const { hooks, statuses } = makeHooks();
        const a = createWsAdapter(spec(), hooks);
        a.connect();
        lastWs().fireOpen();
        a.disconnect();
        expect(statuses[statuses.length - 1]).toBe('disabled');
        expect(a.isAlive()).toBe(false);
        jest.advanceTimersByTime(120000);
        expect(wsCount()).toBe(1);       // 不因 disconnect 觸發的 close 而重連
    });
});

describe('createTreeAdapter', () => {
    it('connects without a key and sends the login frame when a key is set', () => {
        const { hooks } = makeHooks();
        createTreeAdapter({}, hooks).connect();
        lastWs().fireOpen();
        expect(lastWs().url).toBe(TREE_WS_URL);
        expect(lastWs().sent).toEqual([]);          // 免 key:不送 login

        createTreeAdapter({ apiKey: 'k1' }, hooks).connect();
        lastWs().fireOpen();
        expect(lastWs().sent).toEqual(['login k1']); // 官方純文字認證
    });
});

describe('createFjAdapter', () => {
    it('requires a key and puts it in the query string (official design)', () => {
        const { hooks, statuses } = makeHooks();
        createFjAdapter({}, hooks).connect();
        expect(wsCount()).toBe(0);
        expect(statuses).toEqual(['needs-key']);

        createFjAdapter({ apiKey: 'a b&c' }, hooks).connect();
        expect(lastWs().url).toContain('apikey=a%20b%26c'); // 有做 encode
    });
});

describe('createAlpacaAdapter', () => {
    const connectAlpaca = () => {
        const h = makeHooks();
        const a = createAlpacaAdapter({ keyId: 'id', secret: 's' }, h.hooks);
        a.connect();
        lastWs().fireOpen();
        return { ...h, adapter: a, ws: lastWs() };
    };

    it('auth → subscribe → connected handshake', () => {
        const { ws, statuses } = connectAlpaca();
        expect(JSON.parse(ws.sent[0])).toEqual({ action: 'auth', key: 'id', secret: 's' });
        expect(statuses).not.toContain('connected'); // 尚未訂閱前不算連上

        ws.fireMessage([{ T: 'success', msg: 'authenticated' }]);
        expect(JSON.parse(ws.sent[1])).toEqual({ action: 'subscribe', news: ['*'] });

        ws.fireMessage([{ T: 'subscription', news: ['*'] }]);
        expect(statuses).toContain('connected');
    });

    it('error 406 (connection limit) → degraded but keeps retrying', () => {
        const { ws, statuses, adapter } = connectAlpaca();
        ws.fireMessage([{ T: 'error', code: 406, msg: 'connection limit exceeded' }]);
        expect(statuses).toContain('degraded');
        ws.fireClose();
        jest.advanceTimersByTime(61000);
        expect(wsCount()).toBe(2);          // 自癒重連
        expect(adapter.isAlive()).toBe(false);
    });

    it('fatal auth codes stop retrying; unknown codes do NOT (regression for review fix)', () => {
        for (const code of ALPACA_FATAL_AUTH_CODES) {
            FakeWebSocket.instances = [];
            const { ws, statuses } = connectAlpaca();
            ws.fireMessage([{ T: 'error', code }]);
            expect(statuses).toContain('needs-key');
            const n = wsCount();
            jest.advanceTimersByTime(120000);
            expect(wsCount()).toBe(n);      // 憑證錯誤:永久終止
        }

        // 400/500 等未知/暫時性錯誤:標 degraded,仍走一般重連(修正前會誤判永久終止)
        for (const code of [400, 405, 500]) {
            FakeWebSocket.instances = [];
            const { ws, statuses } = connectAlpaca();
            ws.fireMessage([{ T: 'error', code }]);
            expect(statuses).toContain('degraded');
            expect(statuses).not.toContain('needs-key');
            ws.fireClose();
            jest.advanceTimersByTime(61000);
            expect(wsCount()).toBe(2);      // 有重連
        }
    });

    it('emits raw frames for the parser and tolerates malformed JSON', () => {
        const { ws, raws } = connectAlpaca();
        ws.fireMessage([{ T: 'n', id: 1, headline: 'x' }]);
        expect(raws.length).toBe(1);
        expect(() => ws.fireMessage('not json')).not.toThrow();
    });
});

describe('createJin10Adapter', () => {
    const connectJin10 = (cfg = {}) => {
        const h = makeHooks();
        createJin10Adapter({ secretKey: 'sk', ...cfg }, h.hooks).connect();
        lastWs().fireOpen();
        return { ...h, ws: lastWs() };
    };

    it('runs the official three-step handshake and only then reports connected', () => {
        const { ws, statuses } = connectJin10({ categories: ['1', '3'], language: 'traditional' });
        expect(ws.url).toBe(JIN10_WS_URL);
        expect(ws.sent).toEqual([]); // 連上先等 connected_result,不主動送

        ws.fireMessage({ type: 'connected_result', data: { connected_result: 200 } });
        expect(JSON.parse(ws.sent[0])).toEqual({ action: 'auth', params: { 'secret-key': 'sk' } });

        ws.fireMessage({ type: 'auth_result', data: { auth_result: 200 } });
        expect(JSON.parse(ws.sent[1])).toEqual({
            action: 'subscribe',
            params: { category: ['1', '3'], language: 'traditional' },
        });
        expect(statuses).not.toContain('connected');

        ws.fireMessage({ type: 'subscribe_result', data: { subscribe_result: 200 } });
        expect(statuses).toContain('connected');
    });

    it('auth rejection → needs-key and no auth retry loop', () => {
        const { ws, statuses } = connectJin10();
        ws.fireMessage({ type: 'connected_result', data: { connected_result: 200 } });
        ws.fireMessage({ type: 'auth_result', data: { auth_result: 401, message: 'bad key' } });
        expect(statuses).toContain('needs-key');
        const n = wsCount();
        jest.advanceTimersByTime(120000);
        expect(wsCount()).toBe(n);
    });

    it('subscribe rejection → degraded and stops (params are fixed, retrying is futile)', () => {
        const { ws, statuses } = connectJin10();
        ws.fireMessage({ type: 'connected_result', data: { connected_result: 200 } });
        ws.fireMessage({ type: 'auth_result', data: { auth_result: 200 } });
        ws.fireMessage({ type: 'subscribe_result', data: { subscribe_result: 400 } });
        expect(statuses).toContain('degraded');
        const n = wsCount();
        jest.advanceTimersByTime(120000);
        expect(wsCount()).toBe(n);
    });

    it('emits only data frames (control frames are consumed by the adapter)', () => {
        const { ws, raws } = connectJin10();
        ws.fireMessage({ type: 'connected_result', data: { connected_result: 200 } });
        ws.fireMessage({ type: 'auth_result', data: { auth_result: 200 } });
        ws.fireMessage({ type: 'subscribe_result', data: { subscribe_result: 200 } });
        expect(raws).toHaveLength(0);
        ws.fireMessage({ type: 'data', data: { id: '1', time: '2026-07-20 10:00:00', data: { content: 'x' }, action: 1 } });
        expect(raws).toHaveLength(1);
        expect(raws[0].type).toBe('data');
    });

    it('missing secretKey → needs-key without opening a socket', () => {
        const { hooks, statuses } = makeHooks();
        createJin10Adapter({}, hooks).connect();
        expect(wsCount()).toBe(0);
        expect(statuses).toEqual(['needs-key']);
    });
});
