/** @type {import('jest').Config} */
const config = {
    testTimeout: 90000, // 90 seconds for CI environment stability
    testEnvironment: 'node',
    // Run tests sequentially to avoid Chrome instance conflicts
    maxWorkers: 1,
};

module.exports = config;
