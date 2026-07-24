import { validateFeedUrl } from '../../modules/utils/urlSafety.js';

const PRIVATE = 'Feed URL points to private network';

describe('urlSafety.validateFeedUrl', () => {
    describe('accepts normal public feeds', () => {
        it.each([
            'https://example.com/feed.xml',
            'http://feeds.bbci.co.uk/news/rss.xml',
            'https://fc2.com/rss',                  // fc-prefixed domain ≠ IPv6 ULA
            'https://fdroid-mirror.org/feed',       // fd-prefixed domain
            'https://fe80something.dev/feed',       // fe80-prefixed domain
            'http://172.32.0.1/feed',               // just outside 172.16.0.0/12
            'http://100.63.255.254/feed',           // just below 100.64.0.0/10
            'http://100.128.0.1/feed',              // just above 100.64.0.0/10
            'https://[2606:4700::6810:85e5]/feed',  // public IPv6 literal
        ])('%s', (url) => {
            expect(validateFeedUrl(url)).toBeNull();
        });
    });

    describe('rejects unparseable input', () => {
        it.each(['', 'not a url', 'http://'])('%j', (url) => {
            expect(validateFeedUrl(url)).toBe('Invalid feed URL');
        });
    });

    describe('rejects non-http(s) protocols', () => {
        it.each([
            'ftp://example.com/feed',
            'file:///etc/passwd',
            'chrome-extension://abcdef/x.xml',
            'javascript:alert(1)',
        ])('%s', (url) => {
            expect(validateFeedUrl(url)).toBe('Invalid feed URL protocol');
        });
    });

    describe('rejects localhost and private/reserved IPv4', () => {
        it.each([
            'http://localhost/feed',
            'http://0.0.0.0/feed',
            'http://127.0.0.1/feed',
            'http://127.8.9.10/feed',                    // full 127.0.0.0/8, not just .0.0.1
            'http://10.1.2.3/feed',
            'http://192.168.1.1/feed',
            'http://172.16.0.1/feed',
            'http://172.31.255.254/feed',
            'http://169.254.169.254/latest/meta-data/',  // cloud metadata endpoint
            'http://100.100.100.200/latest/meta-data/',  // Alibaba Cloud metadata (CGNAT range)
            'http://100.64.0.1/feed',                    // 100.64.0.0/10 lower bound
            'http://100.127.255.254/feed',               // 100.64.0.0/10 upper bound
        ])('%s', (url) => {
            expect(validateFeedUrl(url)).toBe(PRIVATE);
        });
    });

    describe('rejects alternate IPv4 encodings (normalized by new URL())', () => {
        it.each([
            'http://2130706433/feed',  // decimal → 127.0.0.1
            'http://0x7f000001/feed',  // hex     → 127.0.0.1
            'http://0177.0.0.1/feed',  // octal   → 127.0.0.1
            'http://127.1/feed',       // short   → 127.0.0.1
        ])('%s', (url) => {
            expect(validateFeedUrl(url)).toBe(PRIVATE);
        });
    });

    describe('rejects private/reserved IPv6 literals', () => {
        it.each([
            'http://[::1]/feed',              // loopback
            'http://[::]/feed',               // unspecified
            'http://[::ffff:127.0.0.1]/feed', // IPv4-mapped
            'http://[::127.0.0.1]/feed',      // deprecated IPv4-compatible → ::7f00:1
            'http://[fc00::1]/feed',          // ULA fc00::/7
            'http://[fd12:3456::1]/feed',     // ULA fd00::/8
            'http://[fe80::1]/feed',          // link-local
        ])('%s', (url) => {
            expect(validateFeedUrl(url)).toBe(PRIVATE);
        });
    });
});
