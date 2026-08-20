import { defineConfig } from 'vite';

// Pages hosts serve the site under a sub-path. GitLab exposes it as
// CI_PAGES_URL; for GitHub Pages the deploy workflow passes BASE_PATH
// (/<repo>/). Outside CI (dev server, Playwright) there's no sub-path.
const pagesUrl = process.env.CI_PAGES_URL;
const base = process.env.BASE_PATH
  ? process.env.BASE_PATH.replace(/\/?$/, '/')
  : pagesUrl
    ? new URL(pagesUrl).pathname.replace(/\/?$/, '/')
    : '/';

export default defineConfig({
  base,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    passWithNoTests: true,
  },
});
