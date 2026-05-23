import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['src/integration/**'],
    testTimeout: 10000,
    setupFiles: ['./src/test-setup.ts'],
  },
});
