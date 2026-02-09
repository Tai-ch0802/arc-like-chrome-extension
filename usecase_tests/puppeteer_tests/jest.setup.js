// Global Jest setup for Puppeteer E2E tests
// Retry flaky tests up to 2 times to handle intermittent failures
// caused by resource contention during parallel execution on CI VMs.
jest.retryTimes(2, { logErrorsBeforeRetry: true });
