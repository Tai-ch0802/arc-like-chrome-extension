// Unit tests for modules/routing/routingLogic.js (pure functions, BASE-022).
import {
    normalizeHost,
    isRealHttpUrl,
    normalizeUrlForClaim,
    matchRule,
    sortRules,
    isStartupRestored,
    consumeClaim,
    addClaims,
    pruneClaims,
    sanitizeRuleInput,
    CLAIM_TTL_MS,
} from '../../modules/routing/routingLogic.js';

const rule = (over = {}) => ({
    id: over.id || 'r1',
    enabled: true,
    matchType: 'domain',
    pattern: 'example.com',
    groupTitle: 'G',
    groupColor: null,
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...over,
});

describe('normalizeHost', () => {
    test('lowercases and strips leading www.', () => {
        expect(normalizeHost('WWW.Example.COM')).toBe('example.com');
        expect(normalizeHost('docs.example.com')).toBe('docs.example.com');
        expect(normalizeHost('')).toBe('');
    });
});

describe('isRealHttpUrl', () => {
    test('accepts http/https only', () => {
        expect(isRealHttpUrl('https://a.b/')).toBe(true);
        expect(isRealHttpUrl('http://a.b')).toBe(true);
        expect(isRealHttpUrl('chrome://newtab/')).toBe(false);
        expect(isRealHttpUrl('about:blank')).toBe(false);
        expect(isRealHttpUrl('')).toBe(false);
        expect(isRealHttpUrl(undefined)).toBe(false);
    });
});

describe('normalizeUrlForClaim', () => {
    test('drops the hash, keeps query', () => {
        expect(normalizeUrlForClaim('https://a.b/p?q=1#frag')).toBe('https://a.b/p?q=1');
    });
    test('falls back to raw string for invalid URLs', () => {
        expect(normalizeUrlForClaim('not a url')).toBe('not a url');
    });
});

describe('matchRule', () => {
    test('domain match normalizes www on both sides', () => {
        const r = rule({ pattern: 'www.Example.com' });
        expect(matchRule('https://example.com/x', [r])).toBe(r);
        expect(matchRule('https://www.example.com/x', [r])).toBe(r);
        expect(matchRule('https://docs.example.com/x', [r])).toBeNull();
    });
    test('contains matches raw substring of the full URL', () => {
        const r = rule({ matchType: 'contains', pattern: 'google.com' });
        expect(matchRule('https://docs.google.com/doc', [r])).toBe(r);
        expect(matchRule('https://example.com/', [r])).toBeNull();
    });
    test('first rule in array order wins (FR-1.03)', () => {
        const first = rule({ id: 'a', matchType: 'contains', pattern: 'google.com', groupTitle: 'Work' });
        const second = rule({ id: 'b', pattern: 'docs.google.com', groupTitle: 'Docs' });
        expect(matchRule('https://docs.google.com/', [first, second]).id).toBe('a');
    });
    test('disabled rules are skipped', () => {
        const off = rule({ id: 'off', enabled: false });
        const on = rule({ id: 'on' });
        expect(matchRule('https://example.com/', [off, on]).id).toBe('on');
    });
    test('non-http URLs and empty rule lists never match', () => {
        expect(matchRule('chrome://newtab/', [rule()])).toBeNull();
        expect(matchRule('https://example.com/', [])).toBeNull();
        expect(matchRule('https://example.com/', null)).toBeNull();
    });
});

describe('sortRules', () => {
    test('sorts by order then createdAt without mutating input', () => {
        const input = [rule({ id: 'b', order: 1, createdAt: 5 }), rule({ id: 'c', order: 1, createdAt: 2 }), rule({ id: 'a', order: 0 })];
        const sorted = sortRules(input);
        expect(sorted.map(r => r.id)).toEqual(['a', 'c', 'b']);
        expect(input[0].id).toBe('b');
    });
});

describe('isStartupRestored (SA §5.3 matrix)', () => {
    const startupUntil = 10_000;
    test('blank new tab → not restored', () => {
        expect(isStartupRestored({ hadUrlAtCreate: false, hasOpener: false, createdAt: 5_000 }, startupUntil)).toBe(false);
    });
    test('link-opened tab (opener) → not restored', () => {
        expect(isStartupRestored({ hadUrlAtCreate: true, hasOpener: true, createdAt: 5_000 }, startupUntil)).toBe(false);
    });
    test('URL-at-birth, no opener, inside startup window → restored', () => {
        expect(isStartupRestored({ hadUrlAtCreate: true, hasOpener: false, createdAt: 5_000 }, startupUntil)).toBe(true);
    });
    test('desktop-app link (same shape, outside window) → not restored', () => {
        expect(isStartupRestored({ hadUrlAtCreate: true, hasOpener: false, createdAt: 20_000 }, startupUntil)).toBe(false);
    });
    test('no startup seen (startupUntil=0) or no candidate → not restored', () => {
        expect(isStartupRestored({ hadUrlAtCreate: true, hasOpener: false, createdAt: 1 }, 0)).toBe(false);
        expect(isStartupRestored(undefined, startupUntil)).toBe(false);
    });
});

describe('sanitizeRuleInput', () => {
    test('full valid input passes through trimmed and capped', () => {
        const clean = sanitizeRuleInput({
            matchType: 'domain',
            pattern: `  ${'x'.repeat(300)}  `,
            groupTitle: `  ${'t'.repeat(80)}  `,
            groupColor: 'red',
        });
        expect(clean.matchType).toBe('domain');
        expect(clean.pattern).toHaveLength(256);
        expect(clean.groupTitle).toHaveLength(64);
        expect(clean.groupColor).toBe('red');
    });
    test('rejects an invalid matchType', () => {
        expect(sanitizeRuleInput({ matchType: 'regex' })).toBeNull();
    });
    test('rejects empty pattern/title after trimming', () => {
        expect(sanitizeRuleInput({ pattern: '   ' })).toBeNull();
        expect(sanitizeRuleInput({ groupTitle: '' })).toBeNull();
    });
    test('rejects a color outside the Chrome enum; null/undefined color is allowed', () => {
        expect(sanitizeRuleInput({ groupColor: 'magenta' })).toBeNull();
        expect(sanitizeRuleInput({ groupColor: null })).toEqual({ groupColor: null });
        expect(sanitizeRuleInput({ groupColor: undefined })).toEqual({ groupColor: null });
    });
    test('is partial: only provided keys are checked and returned; unknown keys dropped', () => {
        expect(sanitizeRuleInput({ groupTitle: 'News', order: 99, id: 'hack' })).toEqual({ groupTitle: 'News' });
    });
    test('coerces enabled to a boolean', () => {
        expect(sanitizeRuleInput({ enabled: 1 })).toEqual({ enabled: true });
        expect(sanitizeRuleInput({ enabled: 0 })).toEqual({ enabled: false });
    });
});

describe('claims lifecycle', () => {
    test('addClaims registers with TTL; duplicates accumulate count', () => {
        const claims = {};
        addClaims(claims, ['https://a.b/x', 'https://a.b/x#frag'], 1_000);
        expect(claims['https://a.b/x']).toEqual({ count: 2, expiresAt: 1_000 + CLAIM_TTL_MS });
    });
    test('consumeClaim decrements and deletes at zero', () => {
        const claims = {};
        addClaims(claims, ['https://a.b/x'], 1_000);
        expect(consumeClaim(claims, 'https://a.b/x#other-frag', 2_000)).toBe(true);
        expect(claims['https://a.b/x']).toBeUndefined();
        expect(consumeClaim(claims, 'https://a.b/x', 2_000)).toBe(false);
    });
    test('expired claims are not consumed and get pruned', () => {
        const claims = {};
        addClaims(claims, ['https://a.b/x'], 1_000);
        expect(consumeClaim(claims, 'https://a.b/x', 1_000 + CLAIM_TTL_MS)).toBe(false);
        expect(claims['https://a.b/x']).toBeUndefined();
    });
    test('pruneClaims drops only expired entries', () => {
        const claims = {};
        addClaims(claims, ['https://a.b/old'], 0);
        addClaims(claims, ['https://a.b/new'], 50_000);
        pruneClaims(claims, 40_000);
        expect(Object.keys(claims)).toEqual(['https://a.b/new']);
    });
});
