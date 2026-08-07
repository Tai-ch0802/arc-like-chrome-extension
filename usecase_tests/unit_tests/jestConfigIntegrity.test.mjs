// Jest scan-scope guard. `.claude/worktrees/` holds live git worktrees of this
// same repo, each carrying its own copy of usecase_tests/ (and sometimes its own
// node_modules with an ESM-only puppeteer). Without an explicit ignore list Jest
// scanned them too: 258 suites instead of 56, with 56 bogus "Test suite failed
// to run" failures masking real ones locally. CI never saw it — no worktrees there.
//
// The trap this guards: testPathIgnorePatterns REPLACES Jest's default
// ['/node_modules/'] rather than extending it, so dropping /node_modules/ from
// the list silently pulls dependency tests back into the scan.
import config from '../../jest.config.js';

const IGNORED = [
    '/repo/.claude/worktrees/some-branch-abc123/usecase_tests/unit_tests/foo.test.mjs',
    '/repo/node_modules/some-dep/lib/bar.test.js',
];

const SCANNED = [
    '/repo/usecase_tests/unit_tests/foo.test.mjs',
    '/repo/usecase_tests/puppeteer_tests/bar.test.js',
    '/repo/benchmark/modal_perf.test.js',
];

const matches = (p) => (config.testPathIgnorePatterns || []).some(pattern => new RegExp(pattern).test(p));

describe('jest testPathIgnorePatterns', () => {
    test.each(IGNORED)('ignores %s', (p) => {
        expect(matches(p)).toBe(true);
    });

    test.each(SCANNED)('still scans %s', (p) => {
        expect(matches(p)).toBe(false);
    });
});
