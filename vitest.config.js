import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'], // only run JS tests
    exclude: ['tests/**/*.test.cjs'], // ignore any CJS tests
  },
});
