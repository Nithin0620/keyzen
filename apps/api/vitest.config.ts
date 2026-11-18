import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      all: true,
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
        'src/auth/**': { lines: 70, functions: 70, branches: 60, statements: 70 },
        'src/authz/**': { lines: 80, functions: 80, branches: 70, statements: 80 },
        'src/crypto/**': { lines: 70, functions: 70, branches: 60, statements: 70 },
      },
    },
  },
});
