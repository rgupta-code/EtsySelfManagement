module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/*.test.js',
    '!server/**/*.spec.js',
    '!server/app.js', // Exclude main app file from coverage as it's mostly configuration
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/dist/**'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Separate test patterns for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/server/**/*.test.js'],
      testPathIgnorePatterns: ['integration.test.js']
    },
    {
      displayName: 'integration', 
      testMatch: ['<rootDir>/server/**/*.integration.test.js']
    }
  ]
};