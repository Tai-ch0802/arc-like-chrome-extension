import { parseFj, parseAlpaca, parseJin10, parseBeijingTime } from '../../modules/newswire/normalizer.js';

const NOW = 1753000000000;

describe('newswire source parsers (BASE-016 N2)', () => {
  describe('parseBeijingTime', () => {
    it('parses Beijing wall-clock to UTC epoch (UTC+8)', () => {
      expect(parseBeijingTime('2023-11-14 11:40:36')).toBe(Date.parse('2023-11-14T11:40:36+08:00'));
      expect(parseBeijingTime('2023-11-14T11:40:36')).toBe(Date.parse('2023-11-14T11:40:36+08:00'));
    });
    it('returns undefined on malformed input', () => {
      expect(parseBeijingTime('not a time')).toBeUndefined();
      expect(parseBeijingTime(1234)).toBeUndefined();
      expect(parseBeijingTime(undefined)).toBeUndefined();
    });
  });

  describe('parseFj', () => {
    it('parses news messages and ignores calendar', () => {
      const news = JSON.stringify({ type: 'news', data: { id: 42, headline: 'ECB hikes again', time: '2026-07-20T12:30:00Z', url: 'https://fj.example/n/42' } });
      const [ev] = parseFj(news, NOW);
      expect(ev).toMatchObject({ id: 'fj:42', source: 'fj', title: 'ECB hikes again', url: 'https://fj.example/n/42' });
      expect(ev.tsSource).toBe(Date.parse('2026-07-20T12:30:00Z'));
      expect(parseFj(JSON.stringify({ type: 'calendar', data: { headline: 'x' } }), NOW)).toEqual([]);
    });
    it('tolerates array data and missing time (falls back to ingest)', () => {
      const msg = { type: 'news', data: [{ id: 1, headline: 'a' }, { id: 2, headline: 'b', time: 'garbage' }] };
      const out = parseFj(msg, NOW);
      expect(out.map((e) => e.id)).toEqual(['fj:1', 'fj:2']);
      expect(out[0].tsSource).toBe(NOW);
      expect(out[1].tsSource).toBe(NOW);
    });
    it('returns [] on garbage', () => {
      expect(parseFj('nope', NOW)).toEqual([]);
      expect(parseFj({ type: 'news' }, NOW)).toEqual([]);
    });
  });

  describe('parseAlpaca', () => {
    it('keeps only T==="n" items from the array frame', () => {
      const frame = JSON.stringify([
        { T: 'success', msg: 'authenticated' },
        { T: 'n', id: 9001, headline: 'NVDA pops on earnings', created_at: '2026-07-20T13:00:00Z', url: 'https://alpaca.example/n/9001', symbols: ['NVDA'] },
        { T: 'subscription', news: ['*'] },
      ]);
      const out = parseAlpaca(frame, NOW);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ id: 'alpaca:9001', title: 'NVDA pops on earnings', symbols: ['NVDA'] });
      expect(out[0].tsSource).toBe(Date.parse('2026-07-20T13:00:00Z'));
    });
    it('returns [] for control-only frames and garbage', () => {
      expect(parseAlpaca(JSON.stringify([{ T: 'error', code: 406 }]), NOW)).toEqual([]);
      expect(parseAlpaca('x', NOW)).toEqual([]);
    });
  });

  describe('parseJin10', () => {
    const dataMsg = (over = {}, inner = {}) => ({
      type: 'data',
      data: {
        id: '20231114114036539800',
        type: 0,
        time: '2023-11-14 11:40:36',
        important: 0,
        data: { content: '金十圖示:<b>A50</b> 午盤行情一覽', pic: '', title: '', ...inner },
        action: 1,
        ...over,
      },
    });
    it('parses an add message: strips HTML, converts Beijing time, maps important', () => {
      const [ev] = parseJin10(dataMsg({ important: 1 }), NOW);
      expect(ev).toMatchObject({ id: 'jin10:20231114114036539800', source: 'jin10', srcImportant: true });
      expect(ev.title).toBe('金十圖示: A50 午盤行情一覽');
      expect(ev.tsSource).toBe(Date.parse('2023-11-14T11:40:36+08:00'));
    });
    it('prefers data.title over content when present', () => {
      const [ev] = parseJin10(dataMsg({}, { title: '標題優先', content: '內文' }), NOW);
      expect(ev.title).toBe('標題優先');
    });
    it('ignores modify/delete actions (v1) and non-data messages', () => {
      expect(parseJin10(dataMsg({ action: 2 }), NOW)).toEqual([]);
      expect(parseJin10(dataMsg({ action: 3 }), NOW)).toEqual([]);
      expect(parseJin10({ type: 'auth_result', data: { auth_result: 200 } }, NOW)).toEqual([]);
      expect(parseJin10('garbage', NOW)).toEqual([]);
    });
    it('treats missing action as an add (REST fallback shape)', () => {
      const msg = dataMsg();
      delete msg.data.action;
      expect(parseJin10(msg, NOW)).toHaveLength(1);
    });
  });
});
