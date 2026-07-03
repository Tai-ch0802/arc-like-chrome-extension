import { extractJsonArray, extractJsonObject } from '../../modules/ai/jsonExtract.js';

describe('extractJsonArray', () => {
  it('parses a plain JSON array', () => {
    expect(extractJsonArray('[{"theme":"🛠️ Dev","tabIds":[1,2]}]'))
      .toEqual([{ theme: '🛠️ Dev', tabIds: [1, 2] }]);
  });

  it('parses an empty array (cleanup "no candidates" reply)', () => {
    expect(extractJsonArray('[]')).toEqual([]);
  });

  it('strips ```json code fences', () => {
    const raw = '```json\n[{"label":"📚 Docs"}]\n```';
    expect(extractJsonArray(raw)).toEqual([{ label: '📚 Docs' }]);
  });

  it('strips bare ``` code fences', () => {
    const raw = '```\n[{"index":0,"reason":"match"}]\n```';
    expect(extractJsonArray(raw)).toEqual([{ index: 0, reason: 'match' }]);
  });

  it('extracts an array wrapped in prose', () => {
    const raw = 'Sure! Here are the groups:\n[{"theme":"News","tabIds":[3]}]\nHope that helps.';
    expect(extractJsonArray(raw)).toEqual([{ theme: 'News', tabIds: [3] }]);
  });

  it('handles nested arrays inside objects (greedy match)', () => {
    const raw = 'result: [{"theme":"A","tabIds":[1,2]},{"theme":"B","tabIds":[3]}] done';
    expect(extractJsonArray(raw)).toEqual([
      { theme: 'A', tabIds: [1, 2] },
      { theme: 'B', tabIds: [3] },
    ]);
  });

  it('falls back to lazy match when trailing brackets break the greedy span', () => {
    const raw = '[{"label":"X"}] as seen in [source]';
    expect(extractJsonArray(raw)).toEqual([{ label: 'X' }]);
  });

  it('returns null for garbage', () => {
    expect(extractJsonArray('no json here')).toBeNull();
    expect(extractJsonArray('')).toBeNull();
    expect(extractJsonArray(null)).toBeNull();
    expect(extractJsonArray(undefined)).toBeNull();
  });

  it('returns null for a bare object (not an array)', () => {
    expect(extractJsonArray('{"theme":"A"}')).toBeNull();
  });
});

describe('extractJsonObject', () => {
  it('parses a plain JSON object', () => {
    expect(extractJsonObject('{"tldr":"summary","keyPoints":["a","b"]}'))
      .toEqual({ tldr: 'summary', keyPoints: ['a', 'b'] });
  });

  it('strips code fences and prose', () => {
    const raw = 'Here you go:\n```json\n{"tldr":"x","keyPoints":[]}\n```\nEnjoy!';
    expect(extractJsonObject(raw)).toEqual({ tldr: 'x', keyPoints: [] });
  });

  it('handles nested objects (greedy match)', () => {
    const raw = 'out: {"tldr":"x","meta":{"lang":"zh"}} end';
    expect(extractJsonObject(raw)).toEqual({ tldr: 'x', meta: { lang: 'zh' } });
  });

  it('returns null for arrays and garbage', () => {
    expect(extractJsonObject('[1,2]')).toBeNull();
    expect(extractJsonObject('nope')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
  });
});
