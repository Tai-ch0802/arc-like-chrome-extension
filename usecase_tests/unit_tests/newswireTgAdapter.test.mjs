/**
 * tgAdapter 狀態機測試（BASE-018 TG1）。以 fake GramJS client + fake timers
 * 驅動完整生命週期,不需真 GramJS/網路。
 */
import { createTgAdapter, classifyTgError, eventChatId } from '../../modules/newswire/tgAdapter.js';

// fake GramJS NewMessage：只記下建構參數(chats)。
class FakeNewMessage { constructor(opts) { this.opts = opts; } }

// fake client 工廠:可控 connect 成功/拋錯、記錄 addEventHandler、手動觸發事件。
function makeClientFactory(behavior = {}) {
  const created = [];
  const factory = (cfg) => {
    const client = {
      cfg, connected: false, handlers: [], disconnected: false,
      async connect() {
        if (behavior.connectError) throw behavior.connectError;
        this.connected = true;
      },
      async getEntity(ref) {
        if (behavior.getEntityError) throw behavior.getEntityError;
        if (Array.isArray(behavior.failRefs) && behavior.failRefs.includes(ref)) {
          throw Object.assign(new Error('USERNAME_NOT_OCCUPIED'), { errorMessage: 'USERNAME_NOT_OCCUPIED' });
        }
        const id = behavior.idFor ? behavior.idFor(ref) : (behavior.entityId ?? 100);
        return { id, username: typeof ref === 'string' ? ref : undefined, title: 'Chan' };
      },
      addEventHandler(cb, ev) { this.handlers.push({ cb, ev }); },
      async disconnect() { this.disconnected = true; this.connected = false; },
      emit(event) { this.handlers.forEach((h) => h.cb(event)); },
    };
    created.push(client);
    return client;
  };
  factory.created = created;
  factory.last = () => created[created.length - 1];
  return factory;
}

function makeDeps(behavior) {
  const timers = [];
  const factory = makeClientFactory(behavior);
  return {
    factory, timers,
    deps: {
      createClient: factory,
      NewMessage: FakeNewMessage,
      setTimer: (fn) => { timers.push(fn); return timers.length; },
      clearTimer: (id) => { timers[id - 1] = null; },
      computeBackoff: () => 5000,
    },
  };
}
const cfg = (over = {}) => ({ session: 's', apiId: 1, apiHash: 'h', channels: [{ username: 'BWEnews' }], ...over });
const hooks = () => { const statuses = []; const raws = []; return { statuses, raws, h: { onStatus: (s) => statuses.push(s), onRaw: (r) => raws.push(r) } }; };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('classifyTgError (pure)', () => {
  it('REAL GramJS FloodWaitError shape → flood (message lacks FLOOD_WAIT token; e.seconds is authoritative)', () => {
    // 真實 GramJS:seconds 帶秒數,message 是人類語句,errorMessage='FLOOD'。
    expect(classifyTgError({ seconds: 120, message: 'A wait of 120 seconds is required (caused by ...)', errorMessage: 'FLOOD' }))
      .toEqual({ kind: 'flood', seconds: 120 });
  });
  it('flood string fallbacks when seconds is absent', () => {
    expect(classifyTgError({ errorMessage: 'FLOOD_WAIT_17' })).toEqual({ kind: 'flood', seconds: 17 });
    expect(classifyTgError({ message: 'A wait of 42 seconds is required' })).toEqual({ kind: 'flood', seconds: 42 });
  });
  it('auth/session/api errors → fatal (incl. SESSION_EXPIRED / API_ID_INVALID / AUTH_KEY_PERM_EMPTY)', () => {
    for (const m of ['AUTH_KEY_UNREGISTERED', 'AUTH_KEY_INVALID', 'AUTH_KEY_DUPLICATED', 'AUTH_KEY_PERM_EMPTY',
      'SESSION_REVOKED', 'SESSION_EXPIRED', 'SESSION_PASSWORD_NEEDED', 'USER_DEACTIVATED',
      'API_ID_INVALID', 'API_ID_PUBLISHED_FLOOD']) {
      expect(classifyTgError({ errorMessage: m }).kind).toBe('fatal');
    }
  });
  it('unknown/network errors → transient', () => {
    expect(classifyTgError({ message: 'ECONNRESET' }).kind).toBe('transient');
    expect(classifyTgError({ message: 'Timeout' }).kind).toBe('transient');
    expect(classifyTgError(null).kind).toBe('transient');
  });
});

describe('eventChatId (pure)', () => {
  it('reads chatId or peerId.channelId, stringified', () => {
    expect(eventChatId({ chatId: 555n })).toBe('555');
    expect(eventChatId({ message: { peerId: { channelId: 42 } } })).toBe('42');
    expect(eventChatId({})).toBeUndefined();
  });
});

describe('createTgAdapter — lifecycle', () => {
  it('connect → getEntity → subscribe → connected; new message maps to {message, channel}', async () => {
    const { deps, factory } = makeDeps();
    const { statuses, raws, h } = hooks();
    const a = createTgAdapter(cfg(), h, deps);
    a.connect();
    await flush();
    expect(statuses).toContain('connecting');
    expect(statuses).toContain('connected');
    expect(a.isAlive()).toBe(true);
    const client = factory.last();
    expect(client.handlers[0].ev.opts.chats.length).toBe(1); // subscribed to 1 entity
    // 回歸防護:chats 必須傳頻道識別碼(id)而非 entity 物件——teleproto EventBuilder 對每個
    // 元素 .toString(),entity 物件 → "[object Object]" → resolve 失敗 → filter 永久短路 →
    // 一則訊息都收不到(連上卻無 raw)。傳 id → toString 為數字字串 → 正確解析。
    expect(client.handlers[0].ev.opts.chats).toEqual([100]);
    expect(typeof client.handlers[0].ev.opts.chats[0]).not.toBe('object');

    client.emit({ chatId: '100', message: { id: 9, message: 'hi', date: 1 } });
    expect(raws).toHaveLength(1);
    expect(raws[0].message.message).toBe('hi');
    expect(raws[0].channel).toMatchObject({ id: 100, username: 'BWEnews' });
  });

  it('REAL FloodWaitError → schedules reconnect (honors e.seconds even though message lacks FLOOD_WAIT token)', async () => {
    const err = Object.assign(new Error('A wait of 30 seconds is required'), { seconds: 30, errorMessage: 'FLOOD' });
    const { deps, timers } = makeDeps({ connectError: err });
    const { statuses, h } = hooks();
    createTgAdapter(cfg(), h, deps).connect();
    await flush();
    expect(statuses).toContain('retrying');
    expect(timers.length).toBe(1); // 已排程重連（遵守 30s，非立即；不會誤判 transient 提前重連）
  });

  it('fatal errors (SESSION_REVOKED / SESSION_EXPIRED / API_ID_INVALID) → needs-key, NO reconnect loop', async () => {
    for (const em of ['SESSION_REVOKED', 'SESSION_EXPIRED', 'API_ID_INVALID']) {
      const err = Object.assign(new Error('x'), { errorMessage: em });
      const { deps, timers } = makeDeps({ connectError: err });
      const { statuses, h } = hooks();
      const a = createTgAdapter(cfg(), h, deps);
      a.connect();
      await flush();
      expect(statuses).toContain('needs-key');
      expect(timers.length).toBe(0);       // 不排程重連
      a.connect();                          // watchdog 重複呼叫
      await flush();
      expect(timers.length).toBe(0);        // 仍 no-op（failed）
    }
  });

  it('transient error → exponential-backoff reconnect; degraded after 10 fails, keeps trying', async () => {
    const err = Object.assign(new Error('ECONNRESET'));
    const { deps, timers, factory } = makeDeps({ connectError: err });
    const { statuses, h } = hooks();
    const a = createTgAdapter(cfg(), h, deps);
    a.connect();
    await flush();
    expect(statuses).toContain('retrying');
    // 觸發後續重連直到 degraded
    for (let i = 0; i < 12; i++) { const t = timers.find(Boolean); if (t) { const idx = timers.indexOf(t); timers[idx] = null; t(); await flush(); } }
    expect(statuses).toContain('degraded');
    expect(factory.created.length).toBeGreaterThan(10); // 仍持續嘗試,未放棄
  });

  it('disconnect closes client, cancels backoff, reports disabled; no reconnect', async () => {
    const { deps, timers, factory } = makeDeps();
    const { statuses, h } = hooks();
    const a = createTgAdapter(cfg(), h, deps);
    a.connect();
    await flush();
    a.disconnect();
    expect(statuses[statuses.length - 1]).toBe('disabled');
    expect(factory.last().disconnected).toBe(true);
    expect(a.isAlive()).toBe(false);
  });

  it('ALL channels unresolvable (channel-level) → transient reconnect (not fatal)', async () => {
    const { deps } = makeDeps({ getEntityError: Object.assign(new Error('x'), { errorMessage: 'CHANNEL_INVALID' }) });
    const { statuses, h } = hooks();
    createTgAdapter(cfg(), h, deps).connect();
    await flush();
    expect(statuses).toContain('retrying'); // 一個都解析不到 → 暫時性重連
    expect(statuses).not.toContain('needs-key');
  });

  it('session dies at getEntity stage (not connect) → needs-key, NO reconnect (FR-10, PR#194 review)', async () => {
    // connect() 成功但 session 已撤銷:GramJS 到第一個 API call(getEntity)才回 fatal。
    // 全頻道都因此失敗時,必須判 fatal 進 needs-key,而非泛用 'no channel resolved' → transient。
    const { deps, timers } = makeDeps({ getEntityError: Object.assign(new Error('x'), { errorMessage: 'SESSION_REVOKED' }) });
    const { statuses, h } = hooks();
    const a = createTgAdapter(cfg(), h, deps);
    a.connect();
    await flush();
    expect(statuses).toContain('needs-key');
    expect(statuses).not.toContain('retrying');
    expect(timers.length).toBe(0); // 不排程重連
    a.connect(); await flush();     // watchdog 重複呼叫
    expect(timers.length).toBe(0);  // 仍 no-op(failed)
  });

  it('one bad channel among good ones is skipped; source still connects to the rest (#3)', async () => {
    const { deps, factory } = makeDeps({ failRefs: ['bad'], idFor: (ref) => (ref === 'good' ? 11 : 22) });
    const { statuses, raws, h } = hooks();
    const a = createTgAdapter(cfg({ channels: [{ username: 'good' }, { username: 'bad' }] }), h, deps);
    a.connect();
    await flush();
    expect(statuses).toContain('connected');   // 未因壞頻道整個 retry
    expect(a.isAlive()).toBe(true);
    const client = factory.last();
    expect(client.handlers[0].ev.opts.chats.length).toBe(1); // 只訂到好的那個
    client.emit({ chatId: '11', message: { id: 1, message: 'ok', date: 1 } });
    expect(raws[0].channel.username).toBe('good');
  });

  it('disconnect during the createClient await → no orphan, no false connected (async-race, TG2b)', async () => {
    // TG2b:createClient 為 async(dynamic import 2.6M bundle),await 期間 disconnect
    // 不得留下已連線但無人管的 orphan client,也不得在 disabled 後誤報 connected。
    const { statuses, h } = hooks();
    let resolveClient;
    const client = {
      connected: false, disconnected: false, subscribed: false,
      connect: async () => { client.connected = true; },
      getEntity: async () => ({ id: 100, username: 'BWEnews', title: 'C' }),
      addEventHandler: () => { client.subscribed = true; },
      disconnect: async () => { client.disconnected = true; client.connected = false; },
    };
    const deps = {
      createClient: () => new Promise((r) => { resolveClient = () => r(client); }),
      NewMessage: FakeNewMessage,
      setTimer: () => 1, clearTimer: () => {}, computeBackoff: () => 5000,
    };
    const a = createTgAdapter(cfg(), h, deps);
    a.connect();
    await flush();                 // open() 掛在 await createClient
    a.disconnect();                // stopped=true;此時 module 內 client 仍為 null(pending)
    resolveClient();
    await flush();
    expect(client.disconnected).toBe(true);       // 剛建好的 client 被拆掉(未 orphan)
    expect(client.subscribed).toBe(false);        // 未訂閱(未 addEventHandler)
    expect(statuses).not.toContain('connected');  // 未誤報 connected
    expect(statuses[statuses.length - 1]).toBe('disabled');
  });

  it('rebuild after a drop tears down the stale client (no leak, #5)', async () => {
    const { deps, factory } = makeDeps();
    const { h } = hooks();
    const a = createTgAdapter(cfg(), h, deps);
    a.connect();
    await flush();
    const client1 = factory.last();
    expect(client1.connected).toBe(true);
    client1.connected = false;          // 模擬連線掉落
    a.connect();                        // watchdog 重建
    await flush();
    expect(factory.created.length).toBe(2);   // 新建 client2
    expect(client1.disconnected).toBe(true);  // 舊 client 已拆(未洩漏)
  });
});
