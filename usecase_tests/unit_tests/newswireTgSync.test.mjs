import {
  NEWSWIRE_SOURCE_IDS,
  mergeNewswireConfig,
  mergeNewswireState,
  buildNewswirePayload,
} from '../../modules/newswire/newswireSyncLogic.js';

// tg 憑證與其他源 keys 走同一 opt-in（BASE-018 TG1）；無 sync 層特殊碼——
// 這些測試鎖住「tg 搭既有 keys 便車、隨 prefs.syncKeys on/off/scrub」的行為。
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

  it('syncKeys ON → tg session IS in Drive payload (rides the whole-blob keys sync)', () => {
    const merged = mergeNewswireState({ config: cfg(true), keys: tgKeys }, { config: cfg(true), keys: {} });
    expect(merged.remoteKeys.tg.session).toBe('SECRET-SESSION');
    expect(buildNewswirePayload(merged, 1).keys.tg.session).toBe('SECRET-SESSION');
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
