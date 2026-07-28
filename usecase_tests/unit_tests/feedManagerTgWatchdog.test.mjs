/**
 * shouldReconnectTg 測試（BASE-018 TG2b watchdog）。純函式,決定 tg:ping 回應後是否
 * 重發 tg:connect。以 hasAdapter 判斷:
 *   - 無 adapter(offscreen 被 RSS 重建 adapter-less / tgConnect 失敗)→ 重連。
 *   - 有 adapter 但退避中(retrying/degraded)→ 不重連,交給 adapter 自癒(review 抓到的
 *     「watchdog 每 30s 干預退避/加重 FLOOD_WAIT」問題)。
 */
import { shouldReconnectTg, tgConfigIdentity } from '../../modules/newswire/feedManager.js';

describe('shouldReconnectTg (BASE-018 TG2b watchdog)', () => {
    it('offscreen 無回應(null:不存在/逾時)→ 重連', () => {
        expect(shouldReconnectTg(null)).toBe(true);
    });
    it('已連線(alive)→ 不重連', () => {
        expect(shouldReconnectTg({ alive: true, hasAdapter: true, status: 'connected' })).toBe(false);
    });
    it('offscreen 被 RSS 重建成 adapter-less(hasAdapter=false)→ 重連', () => {
        expect(shouldReconnectTg({ alive: false, hasAdapter: false, status: 'disabled' })).toBe(true);
    });
    it('tgConnect 載入失敗(無 adapter,status=retrying)→ 重連', () => {
        expect(shouldReconnectTg({ alive: false, hasAdapter: false, status: 'retrying' })).toBe(true);
    });
    it('★ adapter 退避中(hasAdapter=true, retrying)→ 不重連(不干預退避/FLOOD_WAIT)', () => {
        expect(shouldReconnectTg({ alive: false, hasAdapter: true, status: 'retrying' })).toBe(false);
    });
    it('adapter degraded(hasAdapter=true)→ 不重連(交給 adapter)', () => {
        expect(shouldReconnectTg({ alive: false, hasAdapter: true, status: 'degraded' })).toBe(false);
    });
    it('連線建立中(hasAdapter=true, connecting)→ 不重連', () => {
        expect(shouldReconnectTg({ alive: false, hasAdapter: true, status: 'connecting' })).toBe(false);
    });
    it('憑證失效(hasAdapter=true, needs-key,終止態)→ 不重連', () => {
        expect(shouldReconnectTg({ alive: false, hasAdapter: true, status: 'needs-key' })).toBe(false);
        // needs-login(session 被作廢)同屬終止態:watchdog 以 hasAdapter 判斷而非 status,
        // 故新增狀態不需改 shouldReconnectTg——此斷言鎖住該設計,避免日後改回看 status
        // 時漏掉新狀態而造成無限重連(對已作廢的 session 重連只會再被拒)。
        expect(shouldReconnectTg({ alive: false, hasAdapter: true, status: 'needs-login' })).toBe(false);
    });
});

/**
 * tgConfigIdentity(BASE-023):handleNewswireConfigChange 據此決定 tg 是否重建。
 * newswireConfig/newswireKeys 是粗粒度 storage key——改 rules、prefs、其他源的
 * key 都會觸發 onChanged;修正前一律全拆重建,每次都把 offscreen 的常駐 MTProto
 * 連線拆掉重撥,放大同一 auth key 短暫雙連線(AUTH_KEY_DUPLICATED)的窗口。
 */
describe('tgConfigIdentity (BASE-023 — tg 內容身分)', () => {
    const config = (tg, over = {}) => ({
        sources: { tg, jin10: { enabled: true, updatedAt: 1 } },
        rules: { p0: ['a'], p1: [], mute: [], updatedAt: 1 },
        prefs: { notificationsEnabled: true, syncKeys: false, updatedAt: 1 },
        ...over,
    });
    const tgSrc = { enabled: true, channels: [{ id: '1', username: 'BWEnews' }], updatedAt: 10 };
    const keys = { tg: { apiId: 1, apiHash: 'h', session: 's' }, jin10: { secretKey: 'k' }, updatedAt: 3 };

    it('★ rules/prefs/其他源 keys/updatedAt 變動 → 身分不變(tg 不重建)', () => {
        const base = tgConfigIdentity(config(tgSrc), keys);
        expect(tgConfigIdentity(config({ ...tgSrc, updatedAt: 99 }), keys)).toBe(base);                  // tg 原樣重存
        expect(tgConfigIdentity(config(tgSrc, { rules: { p0: ['b'], p1: [], mute: [], updatedAt: 99 } }), keys)).toBe(base);
        expect(tgConfigIdentity(config(tgSrc), { ...keys, jin10: { secretKey: 'K2' }, updatedAt: 9 })).toBe(base);
    });

    it('enabled/channels/keys.tg 變動 → 身分改變(需重建)', () => {
        const base = tgConfigIdentity(config(tgSrc), keys);
        expect(tgConfigIdentity(config({ ...tgSrc, enabled: false }), keys)).not.toBe(base);
        expect(tgConfigIdentity(config({ ...tgSrc, channels: [] }), keys)).not.toBe(base);
        expect(tgConfigIdentity(config(tgSrc), { ...keys, tg: { ...keys.tg, session: 's2' } })).not.toBe(base);
    });

    it('null 安全:config/keys 缺漏不拋錯,且與空物件同身分', () => {
        expect(() => tgConfigIdentity(null, null)).not.toThrow();
        expect(tgConfigIdentity(null, null)).toBe(tgConfigIdentity({}, {}));
    });
});
