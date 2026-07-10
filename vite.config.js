import { defineConfig } from 'vite';

// base stays '/' until we wire GitHub Pages deployment (deferred).
export default defineConfig({
  base: '/',
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    passWithNoTests: true,
  },
});
