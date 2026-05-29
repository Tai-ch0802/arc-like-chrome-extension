// Global Jest setup for Puppeteer E2E tests
// Retry flaky tests up to 2 times to handle intermittent failures
// caused by resource contention during parallel execution on CI VMs.
jest.retryTimes(2, { logErrorsBeforeRetry: true });

// Minimal `chrome` stub for the Node test environment so that unit tests can
// import modules whose transitive dependencies reference the chrome.* API at
// module-load time (e.g. i18n helpers). Puppeteer tests run inside the real
// browser page and use the genuine chrome API, so this node-side stub is inert
// for them. Only define if absent to avoid clobbering any real global.
if (typeof globalThis.chrome === 'undefined') {
    globalThis.chrome = {
        i18n: { getMessage: () => '' },
        storage: { onChanged: { addListener: () => {} } },
        commands: { getAll: async () => [] },
        runtime: {},
    };
}
