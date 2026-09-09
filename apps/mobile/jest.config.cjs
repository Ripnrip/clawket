/** @type {import('jest').Config} */
const config = {
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
      diagnostics: false,
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo-modules-core|tweetnacl|js-sha256)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: ['./jest.setup.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
  },
};

module.exports = config;
