/** @type {import('jest').Config} */
const config = {
    testTimeout: 90000, // 90 seconds for CI environment stability
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./usecase_tests/puppeteer_tests/jest.setup.js'],
};

module.exports = config;
