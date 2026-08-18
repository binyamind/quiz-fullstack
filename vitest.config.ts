import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/api/src/**/*.{unit,integration}.test.ts'],
    // Integration tests share one Postgres database, so they must not interleave.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['apps/api/src/**/*.ts'],
      exclude: [
        'apps/api/src/**/*.test.ts',
        'apps/api/src/types/**',
        // Test-only helpers, and the thin CLI/bootstrap wrappers whose bodies are
        // a single call into code that is covered here.
        'apps/api/src/test/**',
        'apps/api/src/server.ts',
        'apps/api/src/infra/migrate-cli.ts',
        'apps/api/src/infra/seed-cli.ts',
      ],
      // SPECS.md requires 100% — CI fails the run rather than merely reporting.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
