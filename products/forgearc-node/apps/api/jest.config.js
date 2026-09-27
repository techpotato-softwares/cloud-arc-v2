/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/../../modules', '<rootDir>/../../packages/shared/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@forgearc/shared$': '<rootDir>/../../packages/shared/src',
    '^@forgearc/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  collectCoverageFrom: [
    '../../packages/shared/src/**/*.ts',
    '../../modules/**/*.ts',
    '!**/node_modules/**',
  ],
};
