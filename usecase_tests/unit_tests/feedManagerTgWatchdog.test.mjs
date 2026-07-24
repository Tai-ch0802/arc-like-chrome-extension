/**
 * shouldReconnectTg 測試（BASE-018 TG2b watchdog）。純函式,決定 tg:ping 回應後是否
 * 重發 tg:connect。咬住對抗式 review 的 finding:offscreen 被 RSS 路徑重建成 adapter-less
 * 時 ping 回 {alive:false},watchdog 必須重連(不能只看有無回應)。
 */
import { shouldReconnectTg } from '../../modules/newswire/feedManager.js';

describe('shouldReconnectTg (BASE-018 TG2b watchdog)', () => {
    it('offscreen 無回應(null:不存在/逾時)→ 重連', () => {
        expect(shouldReconnectTg(null)).toBe(true);
    });
    it('offscreen 在且 tgAdapter alive → 不重連', () => {
        expect(shouldReconnectTg({ alive: true, status: 'connected' })).toBe(false);
    });
    it('offscreen 在但無 live adapter(被 RSS 重建成 adapter-less,status=disabled)→ 重連', () => {
        expect(shouldReconnectTg({ alive: false, status: 'disabled' })).toBe(true);
    });
    it('offscreen tgConnect 失敗回 retrying → 重連(不會卡死)', () => {
        expect(shouldReconnectTg({ alive: false, status: 'retrying' })).toBe(true);
    });
    it('連線建立中(connecting)→ 不重連(給它時間完成)', () => {
        expect(shouldReconnectTg({ alive: false, status: 'connecting' })).toBe(false);
    });
    it('憑證失效(needs-key,終止態)→ 不重連(等使用者重新登入)', () => {
        expect(shouldReconnectTg({ alive: false, status: 'needs-key' })).toBe(false);
    });
});
