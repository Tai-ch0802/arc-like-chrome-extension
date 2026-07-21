import { classify, DEFAULT_RULES, normalizeForMatch } from '../../modules/newswire/rules.js';

const ev = (title, extra = {}) => ({ title, ...extra });

describe('newswire rules (BASE-016 N1)', () => {
  it('P0 keyword hit → importance 0', () => {
    expect(classify(ev('US CPI YoY 3.1% vs 3.0% est'))).toEqual({ importance: 0, muted: false });
    expect(classify(ev('FOMC 決議出爐'))).toEqual({ importance: 0, muted: false });
  });
  it('case-insensitive and NFKC (fullwidth) matching', () => {
    expect(classify(ev('fomc statement released')).importance).toBe(0);
    expect(classify(ev('ＣＰＩ數據')).importance).toBe(0);
  });
  it('P1 keyword hit → importance 1 (zh-TW and zh-CN spellings)', () => {
    expect(classify(ev('台積電法說會重點')).importance).toBe(1);
    expect(classify(ev('台积电业绩超预期')).importance).toBe(1);
    expect(classify(ev('Nvidia unveils new GPU')).importance).toBe(1);
  });
  it('no hit → importance 2', () => {
    expect(classify(ev('Weather is nice today'))).toEqual({ importance: 2, muted: false });
  });
  it('mute hit → muted (dropped by pipeline), regardless of other hits', () => {
    expect(classify(ev('CPI crypto airdrop scam')).muted).toBe(true);
  });
  it('srcImportant (e.g. jin10 important===1) forces P0 without keyword', () => {
    expect(classify(ev('平淡標題', { srcImportant: true })).importance).toBe(0);
  });
  it('custom rules override defaults; empty/missing groups are safe', () => {
    expect(classify(ev('hello CoWoS'), { p0: ['hello'] }).importance).toBe(0);
    expect(classify(ev('CoWoS 產能'), { p0: [], p1: [], mute: [] })).toEqual({ importance: 2, muted: false });
    expect(classify(ev('anything'), {})).toEqual({ importance: 2, muted: false });
  });
  it('DEFAULT_RULES sanity: three groups, non-empty p0/p1', () => {
    expect(DEFAULT_RULES.p0.length).toBeGreaterThan(0);
    expect(DEFAULT_RULES.p1.length).toBeGreaterThan(0);
    expect(Array.isArray(DEFAULT_RULES.mute)).toBe(true);
  });
  it('normalizeForMatch lowercases and applies NFKC', () => {
    expect(normalizeForMatch('ＡＢＣdef')).toBe('abcdef');
  });
});
