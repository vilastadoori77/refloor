import { defineConfig } from 'vitest/config';

// Root Vitest config. Unit + contract suites live in the mock and service
// packages (see docs/spec/automated_tests). The web package is verified by
// manual screenshot-parity / E2E, not unit tests, so it is excluded here.
export default defineConfig({
  test: {
    include: [
      'mock-bc-api/test/**/*.test.ts',
      'inventory-service/test/**/*.test.ts',
    ],
    environment: 'node',
    globals: true,
    testTimeout: 15000,
  },
});
