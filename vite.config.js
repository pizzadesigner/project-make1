import { defineConfig } from 'vite';

// GitLab Pages serves the project under its own sub-path, exposed to CI as
// CI_PAGES_URL. Outside CI (dev server, Playwright) there's no sub-path.
const pagesUrl = process.env.CI_PAGES_URL;
const base = pagesUrl ? new URL(pagesUrl).pathname.replace(/\/?$/, '/') : '/';

export default defineConfig({
  base,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    passWithNoTests: true,
  },
});
