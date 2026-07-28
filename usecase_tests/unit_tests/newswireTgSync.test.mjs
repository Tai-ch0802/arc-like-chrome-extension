import {
  NEWSWIRE_SOURCE_IDS,
  mergeNewswireConfig,
  mergeNewswireState,
  buildNewswirePayload,
  stripTgSession,
} from '../../modules/newswire/newswireSyncLogic.js';

// tg 憑證與其他源 keys 走同一 opt-in（BASE-018 TG1）；apiId/apiHash 搭既有 keys
// 便車、隨 prefs.syncKeys on/off/scrub。**例外:session 是 device-local(BASE-023)**——
// 兩台裝置同用一個 session,MTProto 會以 AUTH_KEY_DUPLICATED 作廢它,故 session
// 永不進 Drive payload、遠端 legacy session 也永不合入本機。
const cfg = (syncKeys, over = {}) => ({
  schemaVersion: 1,
  sources: {
    tree: { enabled: false, updatedAt: 10 },
    tg: { enabled: true, channels: [{ id: 1, username: 'BWEnews' }], updatedAt: 10 },
  },
  rules: { p0: [], p1: [], mute: [], updatedAt: 10 },
  prefs: { notificationsEnabled: true, syncKeys, updatedAt: 10 },
  ...over,
});
const tgKeys = { tg: { apiId: 123, apiHash: 'h', session: 'SECRET-SESSION' }, updatedAt: 5 };

describe('BASE-018 TG1 — tg joins existing key opt-in sync', () => {
  it("'tg' is in the fixed source id set", () => {
    expect(NEWSWIRE_SOURCE_IDS).toContain('tg');
  });

  it('tg channel/subscription config roams unconditionally via per-source LWW (independent of syncKeys)', () => {
    const local = cfg(false); // syncKeys OFF
    const remote = cfg(false, {
      sources: { ...cfg(false).sources, tg: { enabled: true, channels: [{ id: 2, username: 'WatcherGuru' }], updatedAt: 20 } },
    });
    const merged = mergeNewswireConfig(local, remote);
    // 遠端 tg config 較新 → 採用,即使 keys 不同步(config 與 keys 分離)。
    expect(merged.sources.tg.channels).toEqual([{ id: 2, username: 'WatcherGuru' }]);
  });

  it('syncKeys OFF → tg session NOT in Drive payload (default, local-only)', () => {
    const merged = mergeNewswireState({ config: cfg(false), keys: tgKeys }, { config: cfg(false), keys: {} });
    expect(merged.localKeys).toEqual(tgKeys);       // 本機保留
    expect(merged.remoteKeys).toBeUndefined();       // payload 無 keys
    expect(buildNewswirePayload(merged, 1).keys).toBeUndefined();
  });

  it('★ syncKeys ON → apiId/apiHash 漫遊,session 絕不進 Drive payload(device-local,BASE-023)', () => {
    const merged = mergeNewswireState({ config: cfg(true), keys: tgKeys }, { config: cfg(true), keys: {} });
    expect(merged.remoteKeys.tg).toEqual({ apiId: 123, apiHash: 'h' });          // 無 session
    expect(buildNewswirePayload(merged, 1).keys.tg.session).toBeUndefined();
    expect(merged.localKeys.tg.session).toBe('SECRET-SESSION');                  // 本機自己的不丟
  });

  it('★ 遠端 legacy payload 夾帶 session 且較新 → keys 採遠端,但 session 不落地本機、payload 被 scrub', () => {
    // 修正前的事故路徑:裝置 A 的 session 經 Drive 漫遊到裝置 B,兩台同時連線 →
    // AUTH_KEY_DUPLICATED。修正後 B 永遠拿不到 A 的 session(需自行登入取得自己的)。
    const merged = mergeNewswireState(
      { config: cfg(true), keys: { tg: { apiId: 123, apiHash: 'h' }, updatedAt: 5 } },   // 本機尚未登入
      { config: cfg(true), keys: { tg: { apiId: 999, apiHash: 'rh', session: 'ROAMED-FROM-DEVICE-A' }, updatedAt: 50 } },
    );
    expect(merged.localKeys.tg).toEqual({ apiId: 999, apiHash: 'rh' });          // 採遠端 keys、不採 session
    expect(merged.remoteKeys.tg.session).toBeUndefined();                         // 下次 write 即 scrub 遠端
  });

  it('★ 遠端 keys 較新且無 session → 本機 tg 憑證整組保留(session 與生成它的 apiId/apiHash 成對)', () => {
    // PR #219 review:session 不可 re-attach 到遠端漫遊來的 apiId/apiHash 底下——
    // 「A 的 session 配 B 的 apiId/apiHash」是從未驗證過的 cross-device 組合。
    // 本機持有 session 期間整組保留;遠端較新的 apiId/apiHash 照常進 payload,
    // 漫遊給「沒有 session 的裝置」使用。
    const merged = mergeNewswireState(
      { config: cfg(true), keys: tgKeys },                                                // updatedAt 5,有本機 session
      { config: cfg(true), keys: { tg: { apiId: 999, apiHash: 'rh' }, updatedAt: 50 } },  // 遠端較新
    );
    expect(merged.localKeys.tg).toEqual({ apiId: 123, apiHash: 'h', session: 'SECRET-SESSION' });
    expect(merged.remoteKeys.tg).toEqual({ apiId: 999, apiHash: 'rh' });   // 漫遊不受影響
  });

  it('★ 遠端較新且完全沒有 tg 條目 → 本機 tg 憑證整組保留,不留下「只剩 session」的殘缺組合', () => {
    const merged = mergeNewswireState(
      { config: cfg(true), keys: tgKeys },
      { config: cfg(true), keys: { jin10: { secretKey: 'k' }, updatedAt: 50 } },          // 遠端較新、無 tg
    );
    expect(merged.localKeys.tg).toEqual({ apiId: 123, apiHash: 'h', session: 'SECRET-SESSION' });
    expect(merged.remoteKeys.tg).toBeUndefined();                          // payload 依然無 session
  });

  it('stripTgSession:無 session 時回傳原物件(引用相等,不擾動 no-op write guard 的 canonical 比較)', () => {
    const k = { tg: { apiId: 1, apiHash: 'h' }, updatedAt: 5 };
    expect(stripTgSession(k)).toBe(k);
    expect(stripTgSession(null)).toBe(null);
  });

  it('turning opt-in OFF (newer prefs) → tg scrubbed from payload even if remote had it', () => {
    const localOff = { config: cfg(false, { prefs: { notificationsEnabled: true, syncKeys: false, updatedAt: 99 } }), keys: tgKeys };
    const remoteOn = { config: cfg(true, { prefs: { notificationsEnabled: true, syncKeys: true, updatedAt: 50 } }), keys: tgKeys };
    const merged = mergeNewswireState(localOff, remoteOn);
    expect(merged.config.prefs.syncKeys).toBe(false);
    expect(merged.remoteKeys).toBeUndefined();       // scrub
    expect(merged.localKeys.tg.session).toBe('SECRET-SESSION'); // 本機不丟
  });
});
