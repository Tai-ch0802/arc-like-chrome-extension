/** @type {import('jest').Config} */
const config = {
    testTimeout: 90000, // 90 seconds for CI environment stability
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./usecase_tests/puppeteer_tests/jest.setup.js'],
    transform: {
        '^.+\\.m?js$': '<rootDir>/jest.esbuild-transform.cjs',
    },
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/?(*.)+(spec|test).mjs'],
    // Setting this REPLACES Jest's default ['/node_modules/'] — keep it listed.
    // '/\\.claude/' skips the git worktrees under .claude/worktrees/, which carry
    // their own copy of this repo's tests (guard: jestConfigIntegrity.test.mjs).
    testPathIgnorePatterns: ['/node_modules/', '/\\.claude/'],
};

module.exports = config;
