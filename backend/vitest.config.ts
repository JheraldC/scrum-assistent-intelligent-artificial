import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          hookTimeout: 30_000,
          testTimeout: 30_000,
          setupFiles: ['tests/helpers/setup-env.ts'],
          globalSetup: ['tests/helpers/global-setup.ts'],
        },
      },
    ],
  },
});
