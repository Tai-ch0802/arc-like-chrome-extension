import { parseTgMessage } from '../../modules/newswire/normalizer.js';

const NOW = 1753000000000;
// GramJS Message shape (subset): id, message(text/caption), date(unix秒), media
const raw = (over = {}, chan = { id: 100, username: 'BWEnews', title: '方程式新闻 BWEnews' }) => ({
  message: { id: 42, message: 'BTC breaks $100k', date: 1753000001, ...over },
  channel: chan,
});

describe('parseTgMessage (BASE-018 TG1)', () => {
  it('maps a text message to a tg NewsEvent with t.me url and channel title', () => {
    const [ev] = parseTgMessage(raw(), NOW);
    expect(ev).toMatchObject({
      id: 'tg:100:42', source: 'tg', sourceId: '100:42',
      title: 'BTC breaks $100k', url: 'https://t.me/BWEnews/42',
      channelTitle: '方程式新闻 BWEnews',
    });
    expect(ev.tsSource).toBe(1753000001 * 1000);
  });

  it('media without caption → 「[媒體]」placeholder (not dropped)', () => {
    const [ev] = parseTgMessage(raw({ message: '', media: { className: 'MessageMediaPhoto' } }), NOW);
    expect(ev.title).toBe('[媒體]');
  });

  it('media WITH caption keeps the caption text', () => {
    const [ev] = parseTgMessage(raw({ message: 'chart attached', media: {} }), NOW);
    expect(ev.title).toBe('chart attached');
  });

  it('media with caption that sanitizes to empty (whitespace/HTML-only) → [媒體], not dropped (#4)', () => {
    expect(parseTgMessage(raw({ message: '   ', media: {} }), NOW)[0].title).toBe('[媒體]');
    expect(parseTgMessage(raw({ message: '<b></b>', media: {} }), NOW)[0].title).toBe('[媒體]');
  });

  it('no channel username → no url (private-ish), still valid event', () => {
    const [ev] = parseTgMessage(raw({}, { id: 7, title: 'Some Channel' }), NOW);
    expect(ev.url).toBeUndefined();
    expect(ev.id).toBe('tg:7:42');
    expect(ev.channelTitle).toBe('Some Channel');
  });

  it('missing channel id → sourceId is just the message id', () => {
    const [ev] = parseTgMessage(raw({}, {}), NOW);
    expect(ev.sourceId).toBe('42');
    expect(ev.id).toBe('tg:42');
  });

  it('BigInt-ish channel/message ids are stringified', () => {
    const [ev] = parseTgMessage({ message: { id: 5, message: 'x', date: 1 }, channel: { id: 1234567890123n, username: 'c' } }, NOW);
    expect(ev.sourceId).toBe('1234567890123:5');
    expect(ev.url).toBe('https://t.me/c/5');
  });

  it('strips HTML entities and caps length via sanitizeEvent', () => {
    const [ev] = parseTgMessage(raw({ message: '<b>Fed</b> hikes ' + 'x'.repeat(600) }), NOW);
    expect(ev.title.startsWith('Fed hikes')).toBe(true);
    expect(ev.title.length).toBeLessThanOrEqual(500);
  });

  it('garbage / empty inputs → []', () => {
    expect(parseTgMessage(null, NOW)).toEqual([]);
    expect(parseTgMessage({}, NOW)).toEqual([]);
    expect(parseTgMessage({ message: {} }, NOW)).toEqual([]); // no id
    expect(parseTgMessage({ message: { id: 1, message: '', date: 1 } }, NOW)).toEqual([]); // no text, no media → empty title dropped
  });

  it('falls back to ingest time when date missing/invalid', () => {
    const [ev] = parseTgMessage(raw({ date: undefined }), NOW);
    expect(ev.tsSource).toBe(NOW);
  });
});
