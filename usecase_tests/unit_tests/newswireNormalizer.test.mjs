import { parseTree, sanitizeEvent, stripHtml, hashString } from '../../modules/newswire/normalizer.js';

const NOW = 1753000000000;

describe('newswire normalizer (BASE-016 N1)', () => {
  describe('sanitizeEvent', () => {
    it('builds a NewsEvent with composite id and defaults', () => {
      const ev = sanitizeEvent({ source: 'tree', sourceId: 'abc', title: 'Hello', tsSource: 123 }, NOW);
      expect(ev).toMatchObject({ id: 'tree:abc', source: 'tree', sourceId: 'abc', title: 'Hello', tsSource: 123, tsIngest: NOW, srcImportant: false });
    });
    it('rejects unknown source and empty title', () => {
      expect(sanitizeEvent({ source: 'evil', title: 'x' }, NOW)).toBeNull();
      expect(sanitizeEvent({ source: 'tree', title: '   ' }, NOW)).toBeNull();
      expect(sanitizeEvent(null, NOW)).toBeNull();
    });
    it('strips HTML and collapses whitespace in title', () => {
      const ev = sanitizeEvent({ source: 'jin10', title: '<b>金十</b>\n  數據 <img src=x>訊息' }, NOW);
      expect(ev.title).toBe('金十 數據 訊息');
    });
    it('caps title at 500 chars after NFKC', () => {
      const ev = sanitizeEvent({ source: 'tree', title: 'ｘ'.repeat(600) }, NOW);
      expect(ev.title.length).toBe(500);
      expect(ev.title[0]).toBe('x'); // NFKC 全形→半形
    });
    it('accepts only http/https urls (javascript: variants dropped)', () => {
      expect(sanitizeEvent({ source: 'tree', title: 't', url: 'https://a.b/c' }, NOW).url).toBe('https://a.b/c');
      expect(sanitizeEvent({ source: 'tree', title: 't', url: 'javascript:alert(1)' }, NOW).url).toBeUndefined();
      expect(sanitizeEvent({ source: 'tree', title: 't', url: ' jAvAsCrIpT:x' }, NOW).url).toBeUndefined();
      expect(sanitizeEvent({ source: 'tree', title: 't', url: 'not a url' }, NOW).url).toBeUndefined();
    });
    it('falls back to hashed sourceId and ingest time when missing', () => {
      const ev = sanitizeEvent({ source: 'tree', title: 'no id here' }, NOW);
      expect(ev.sourceId).toBe(hashString('no id here:'));
      expect(ev.tsSource).toBe(NOW);
    });
    it('uppercases, trims and caps symbols at 20', () => {
      const ev = sanitizeEvent({ source: 'tree', title: 't', symbols: [' tsm ', 'nvda', ...Array(30).fill('x')] }, NOW);
      expect(ev.symbols.slice(0, 2)).toEqual(['TSM', 'NVDA']);
      expect(ev.symbols.length).toBe(20);
    });
  });

  describe('parseTree', () => {
    it('parses a single JSON string message', () => {
      const raw = JSON.stringify({ _id: '654', title: 'CPI comes in hot', url: 'https://x.com/a/1', time: 1753000001000, suggestions: [{ coin: 'BTC' }] });
      const [ev] = parseTree(raw, NOW);
      expect(ev).toMatchObject({ id: 'tree:654', title: 'CPI comes in hot', url: 'https://x.com/a/1', tsSource: 1753000001000, symbols: ['BTC'] });
    });
    it('parses an array batch (history replay) and object input', () => {
      const batch = [{ _id: '1', title: 'a', time: 1 }, { _id: '2', body: 'b only body', time: 2 }];
      const out = parseTree(batch, NOW);
      expect(out.map((e) => e.id)).toEqual(['tree:1', 'tree:2']);
      expect(out[1].title).toBe('b only body');
    });
    it('returns [] on garbage and skips malformed items', () => {
      expect(parseTree('not json', NOW)).toEqual([]);
      expect(parseTree(undefined, NOW)).toEqual([]);
      expect(parseTree([null, 42, { title: '' }], NOW)).toEqual([]);
    });
  });

  it('stripHtml removes tags only', () => {
    expect(stripHtml('<a href="x">link</a> ok')).toBe(' link  ok');
  });
});
