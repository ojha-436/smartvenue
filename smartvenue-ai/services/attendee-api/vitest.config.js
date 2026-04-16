import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { statements: 70, branches: 60, functions: 70, lines: 70 },
    },
    include: ['src/**/*.test.{js,ts}'],
    testTimeout: 10000,
  },
});
