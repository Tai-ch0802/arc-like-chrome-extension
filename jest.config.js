/** @type {import('jest').Config} */
const config = {
    testTimeout: 60000, // 60 seconds for all tests
    testEnvironment: 'node',
    // Run tests sequentially to avoid Chrome instance conflicts
    maxWorkers: 1,
};

module.exports = config;
