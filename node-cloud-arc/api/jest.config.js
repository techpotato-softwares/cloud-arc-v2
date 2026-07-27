/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/modules', '<rootDir>/layers/shared/nodejs/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@arcforge/shared$': '<rootDir>/layers/shared/nodejs/src',
    '^@arcforge/shared/(.*)$': '<rootDir>/layers/shared/nodejs/src/$1',
  },
  collectCoverageFrom: [
    'layers/shared/nodejs/src/**/*.ts',
    'modules/**/*.ts',
    '!**/node_modules/**',
  ],
};
