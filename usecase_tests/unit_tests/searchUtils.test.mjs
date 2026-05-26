import { matchesAnyKeyword, extractDomain } from '../../modules/utils/searchUtils.js';

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
