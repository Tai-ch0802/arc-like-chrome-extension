import { isTaipeiNightSession, buildP0Notification, NIGHT_START_MIN, NIGHT_END_MIN } from '../../modules/newswire/notify.js';

// 建構「台北某時刻」的 epoch ms:UTC = 台北 - 8h。
const taipei = (h, m) => Date.parse(`2026-07-20T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`);

describe('newswire notify (BASE-016 N4)', () => {
  describe('isTaipeiNightSession', () => {
    it('true inside 20:20–22:35 Taipei (inclusive bounds)', () => {
      expect(isTaipeiNightSession(taipei(20, 20))).toBe(true);
      expect(isTaipeiNightSession(taipei(21, 30))).toBe(true);
      expect(isTaipeiNightSession(taipei(22, 35))).toBe(true);
    });
    it('false outside the window', () => {
      expect(isTaipeiNightSession(taipei(20, 19))).toBe(false);
      expect(isTaipeiNightSession(taipei(22, 36))).toBe(false);
      expect(isTaipeiNightSession(taipei(9, 0))).toBe(false);
      expect(isTaipeiNightSession(taipei(0, 0))).toBe(false);
    });
    it('non-finite input → false', () => {
      expect(isTaipeiNightSession(undefined)).toBe(false);
      expect(isTaipeiNightSession(NaN)).toBe(false);
    });
    it('window constants are correct minutes-of-day', () => {
      expect(NIGHT_START_MIN).toBe(1220);
      expect(NIGHT_END_MIN).toBe(1355);
    });
  });

  describe('buildP0Notification', () => {
    it('day-session event → ⚡ prefix + upper-cased source', () => {
      const ev = { source: 'fj', title: 'US CPI YoY 3.1%', tsSource: taipei(12, 30) };
      expect(buildP0Notification(ev, taipei(12, 30))).toEqual({ title: '⚡ FJ', message: 'US CPI YoY 3.1%' });
    });
    it('night-session event → ⚡夜盤 prefix (keyed on tsSource)', () => {
      const ev = { source: 'jin10', title: '非農大幅超預期', tsSource: taipei(20, 30) };
      expect(buildP0Notification(ev, taipei(21, 0))).toEqual({ title: '⚡夜盤 JIN10', message: '非農大幅超預期' });
    });
    it('falls back to now when tsSource missing; tolerates empty fields', () => {
      const out = buildP0Notification({ title: 't' }, taipei(21, 0));
      expect(out.title).toBe('⚡夜盤');
      expect(buildP0Notification(null, taipei(12, 0))).toEqual({ title: '⚡', message: '' });
    });
  });
});
