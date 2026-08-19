import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': path.join(root, 'apps/web/src') },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: [
      'apps/api/src/**/*.{unit,integration}.test.ts',
      'apps/web/src/**/*.test.ts',
      'apps/web/src/**/*.test.tsx',
    ],
    // Integration tests share one Postgres database, so they must not interleave.
    fileParallelism: false,
    environmentMatchGlobs: [['apps/web/**', 'jsdom']],
    setupFiles: ['apps/web/src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['apps/api/src/**/*.ts', 'apps/web/src/**/*.{ts,tsx}'],
      exclude: [
        'apps/api/src/**/*.test.ts',
        'apps/api/src/types/**',
        'apps/api/src/test/**',
        'apps/api/src/server.ts',
        'apps/api/src/infra/migrate-cli.ts',
        'apps/api/src/infra/seed-cli.ts',
        'apps/web/src/app/**',
        'apps/web/src/test/**',
        'apps/web/src/**/*.test.ts',
        'apps/web/src/**/*.test.tsx',
        'apps/web/src/lib/types.ts',
        // Thin useActionState shells: logic lives in tested actions/.
        'apps/web/src/components/forms/assignment-forms.tsx',
        'apps/web/src/components/forms/class-forms.tsx',
        'apps/web/src/components/forms/create-user-form.tsx',
        'apps/web/src/components/forms/edit-user-forms.tsx',
        'apps/web/src/components/forms/group-forms.tsx',
        'apps/web/src/components/forms/work-forms.tsx',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
