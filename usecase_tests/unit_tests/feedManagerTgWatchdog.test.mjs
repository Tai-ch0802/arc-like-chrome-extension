/**
 * shouldReconnectTg 測試（BASE-018 TG2b watchdog）。純函式,決定 tg:ping 回應後是否
 * 重發 tg:connect。以 hasAdapter 判斷:
 *   - 無 adapter(offscreen 被 RSS 重建 adapter-less / tgConnect 失敗)→ 重連。
 *   - 有 adapter 但退避中(retrying/degraded)→ 不重連,交給 adapter 自癒(review 抓到的
 *     「watchdog 每 30s 干預退避/加重 FLOOD_WAIT」問題)。
 */
import { shouldReconnectTg } from '../../modules/newswire/feedManager.js';

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
    });
});
