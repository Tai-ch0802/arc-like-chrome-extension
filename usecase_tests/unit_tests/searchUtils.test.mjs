import { matchesAnyKeyword, extractDomain } from '../../modules/utils/searchUtils.js';
import { parseSearchQuery, bookmarkMatchesTags } from '../../modules/utils/searchUtils.js';

describe('searchManager.matchesAnyKeyword', () => {
    it('returns true when keyword list is empty', () => {
        expect(matchesAnyKeyword('anything', [])).toBe(true);
        expect(matchesAnyKeyword('anything', '')).toBe(true);
    });

    it('returns true on case-insensitive substring match', () => {
        expect(matchesAnyKeyword('Hello World', ['world'])).toBe(true);
        expect(matchesAnyKeyword('Hello World', ['HELLO'])).toBe(true);
    });

    it('returns false when no keyword matches', () => {
        expect(matchesAnyKeyword('Hello World', ['foo', 'bar'])).toBe(false);
    });

    it('treats space-separated string as multiple keywords (OR)', () => {
        expect(matchesAnyKeyword('react hooks tutorial', 'foo react')).toBe(true);
        expect(matchesAnyKeyword('react hooks tutorial', 'foo bar')).toBe(false);
    });

    it('skips non-string entries inside keyword array', () => {
        expect(matchesAnyKeyword('react', [null, undefined, 'react'])).toBe(true);
        expect(matchesAnyKeyword('react', [null, undefined])).toBe(true); // empty after filter → match all
    });

    it('returns true when keywords is neither array nor string (defensive)', () => {
        expect(matchesAnyKeyword('anything', 42)).toBe(true);
        expect(matchesAnyKeyword('anything', null)).toBe(true);
    });

    it('returns false when text is not a string (defensive)', () => {
        // Real callers always pass strings; this guard exists so a future
        // misuse cannot crash handleSearch via TypeError on toLowerCase().
        expect(matchesAnyKeyword(null, ['x'])).toBe(false);
        expect(matchesAnyKeyword(undefined, ['x'])).toBe(false);
        expect(matchesAnyKeyword(123, ['x'])).toBe(false);
        expect(matchesAnyKeyword({}, ['x'])).toBe(false);
    });

    it('returns true for empty string with empty keyword list', () => {
        // Empty string is a valid string, so the "no keywords → match all" rule applies.
        expect(matchesAnyKeyword('', [])).toBe(true);
    });
});

describe('searchManager.extractDomain', () => {
    it('returns empty string for falsy input', () => {
        expect(extractDomain('')).toBe('');
        expect(extractDomain(null)).toBe('');
        expect(extractDomain(undefined)).toBe('');
    });

    it('extracts hostname from full URL', () => {
        expect(extractDomain('https://example.com/path?q=1')).toBe('example.com');
        expect(extractDomain('http://sub.example.com:8080/foo')).toBe('sub.example.com');
    });

    it('handles URL without protocol via regex fallback', () => {
        expect(extractDomain('example.com/path')).toBe('example.com');
        expect(extractDomain('www.example.com')).toBe('www.example.com');
    });

    it('returns hostname for chrome:// and edge cases', () => {
        expect(extractDomain('chrome://extensions')).toBe('extensions');
    });

    it('returns empty string for completely malformed input', () => {
        expect(extractDomain('!!!')).toBe('!!!'); // regex fallback returns the leading non-/ chars
    });
});

describe('parseSearchQuery', () => {
  it('分離 tag: token 與一般關鍵字', () => {
    expect(parseSearchQuery('react tag:工作')).toEqual({ keywords: ['react'], tags: ['工作'] });
  });
  it('支援引號包住含空白的標籤名', () => {
    expect(parseSearchQuery('tag:"side pj" hooks')).toEqual({ keywords: ['hooks'], tags: ['side pj'] });
  });
  it('多個 tag: 累積、tag 名小寫化', () => {
    expect(parseSearchQuery('tag:Work tag:Read')).toEqual({ keywords: [], tags: ['work', 'read'] });
  });
  it('空字串 → 皆空', () => {
    expect(parseSearchQuery('   ')).toEqual({ keywords: [], tags: [] });
  });
  it('純關鍵字、無 tag', () => {
    expect(parseSearchQuery('foo bar')).toEqual({ keywords: ['foo', 'bar'], tags: [] });
  });
  it('非字串輸入 → 皆空（防禦）', () => {
    expect(parseSearchQuery(null)).toEqual({ keywords: [], tags: [] });
  });
});

describe('bookmarkMatchesTags', () => {
  it('需包含所有 required（AND、大小寫不敏感、精確名稱）', () => {
    expect(bookmarkMatchesTags(['Work', 'Read'], ['work'])).toBe(true);
    expect(bookmarkMatchesTags(['Work'], ['work', 'read'])).toBe(false);
  });
  it('required 為空 → true', () => {
    expect(bookmarkMatchesTags(['Work'], [])).toBe(true);
    expect(bookmarkMatchesTags([], [])).toBe(true);
  });
  it('精確比對，不做子字串', () => {
    expect(bookmarkMatchesTags(['Workspace'], ['work'])).toBe(false);
  });
  it('bookmarkTagNames 為空/缺 → 只有 required 也空才 true', () => {
    expect(bookmarkMatchesTags(undefined, ['work'])).toBe(false);
    expect(bookmarkMatchesTags(undefined, [])).toBe(true);
  });
});
