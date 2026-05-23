import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/integration/**/__tests__/**/*.test.ts'],
    testTimeout: 35_000,
    hookTimeout: 35_000,
    setupFiles: ['./src/test-setup.ts'],
    // Tests d'intégration séquentiels : isolation BullMQ entre scénarios.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
