// The app's core contract, end to end on the production build: every project in
// the data reaches the map, a city opens in place and shows a sourced budget, a
// shared link still loads a city cold, and the list view is a real equivalent.
//
// These assertions are derived from data/projects.csv rather than hard-coded.
// The previous version of this file pinned 9 markers, `Bern` and `Žilina`; the
// dataset moved to four cities and the suite rotted red without anyone noticing,
// because `npm run check` does not run Playwright. Deriving keeps the suite
// honest when a project is added or removed — only a real regression turns it red.
//
// Two traps live here. The map's attention-drawing affordances animate forever —
// `.marker__ripple` and the `.map-view-project` pulse — so those elements never
// satisfy Playwright's "stable" actionability check and every click on one needs
// `{ force: true }` or it times out after 30s. And clicking a marker no longer
// navigates: it zooms the map in place, so the URL must NOT change.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { csvParse } from 'd3';

const projects = csvParse(
  readFileSync(fileURLToPath(new URL('../../data/projects.csv', import.meta.url)), 'utf8'),
);

// A row without a source does not render its numbers (CLAUDE.md), so the city
// used to prove "budget + working source link" has to be a fully sourced one —
// koeln is still a `data pending` placeholder and would prove nothing.
const sourced = projects.find((row) => row.budget_eur && row.source_url);
const budgetOrder = [...projects]
  .sort((a, b) => (Number(a.budget_eur) || -Infinity) - (Number(b.budget_eur) || -Infinity))
  .map((row) => row.city_display);

test('every project in the data reaches the map', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await expect(page.locator('.marker')).toHaveCount(projects.length);
});

test('focusing a city zooms in place and its project shows a sourced budget', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.marker');

  const marker = page.locator(`.marker[aria-label*="${sourced.city_display}"]`);
  await marker.click({ force: true });

  // L1 is in-place: the city is framed and marked focused, and no route changed.
  await expect(marker).toHaveClass(/is-focused/);
  await expect(page).not.toHaveURL(/#\/city\//);

  // L2: the "View project" pill opens the detail overlay over the zoomed map.
  await page.locator('.map-view-project').click({ force: true });
  const budgetRow = page.locator('.city-detail .facts__row', { hasText: 'Budget' }).first();
  await expect(budgetRow.locator('dd')).toContainText('€');

  await budgetRow.locator('.source-chip__summary').click();
  await expect(budgetRow.locator('.source-chip__link')).toHaveAttribute(
    'href',
    new RegExp(`^${sourced.source_url}`),
  );
});

test('a shared deep link loads the city cold, silhouette and all', async ({ page }) => {
  await page.goto(`/#/city/${sourced.city}`);

  // Non-ASCII in the title is deliberate: UTF-8 has to survive CSV → slug → URL
  // → render (CLAUDE.md), and the fixtures that used to cover it left with Žilina.
  await expect(page.locator('.city-header__title')).toHaveText(sourced.project_title);
  await expect(page.locator('.city-silhouette__district').first()).toBeVisible();
});

test('the list view is a sortable equivalent of the map', async ({ page }) => {
  await page.goto('/#/list');
  await expect(page.locator('.project-table tbody tr')).toHaveCount(projects.length);

  // Sorting by budget reorders the rows and announces the sort via aria-sort.
  // Ascending puts the sourceless placeholder (no budget) first — nulls sort low.
  await page.getByRole('button', { name: 'Budget' }).click();
  const budgetHeader = page.locator('th', { has: page.getByRole('button', { name: 'Budget' }) });
  await expect(budgetHeader).toHaveAttribute('aria-sort', 'ascending');
  await expect(page.locator('.project-table tbody th')).toHaveText(budgetOrder);

  // A city link is the one place the table routes to the detail view.
  await page.getByRole('link', { name: sourced.city_display }).click();
  await expect(page).toHaveURL(new RegExp(`#/city/${sourced.city}$`));
});
