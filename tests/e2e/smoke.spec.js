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
// One trap lives here. The map's attention-drawing affordance animates forever —
// `.marker__ripple` — so a marker never satisfies Playwright's "stable"
// actionability check and every click on one needs `{ force: true }` or it times
// out after 30s. And clicking a marker no longer navigates: it zooms the map in
// place, so the URL must NOT change.
//
// The budget assertions used to hang off a `.map-view-project` pill clicked at
// L1. That element (and the `.city-detail` wrapper they looked inside) no longer
// exists in `src/` — the widget stack replaced the pill — so the test asserted a
// path out of L1 the app does not have, and sat red. What it was really proving
// is that a project's budget renders with a working source link, which does not
// depend on *how* the detail view is reached, so it now proves that on the
// `#/city/<slug>` route below. Which affordance replaces the pill at L1 is still
// an open design decision; when it lands, assert the L1 → detail path here.

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

test('focusing a city zooms in place without navigating', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.marker');

  const marker = page.locator(`.marker[aria-label*="${sourced.city_display}"]`);
  await marker.click({ force: true });

  // L1 is in-place: the city is framed and marked focused, and no route changed.
  await expect(marker).toHaveClass(/is-focused/);
  await expect(page).not.toHaveURL(/#\/city\//);

  // The widget stack is what L1 puts around the focused city.
  await expect(page.locator('.widget').first()).toBeVisible();
});

test('a shared deep link loads the city cold, silhouette and sourced budget', async ({ page }) => {
  await page.goto(`/#/city/${sourced.city}`);

  // Non-ASCII in the title is deliberate: UTF-8 has to survive CSV → slug → URL
  // → render (CLAUDE.md), and the fixtures that used to cover it left with Žilina.
  await expect(page.locator('.city-header__title')).toHaveText(sourced.project_title);
  await expect(page.locator('.city-silhouette__district').first()).toBeVisible();

  // A figure and the source behind it, together — the Honesty objective's whole
  // claim. The chip is a <details>, so the link only exists once it is opened.
  const budgetRow = page.locator('.facts__row', { hasText: 'Budget' }).first();
  await expect(budgetRow.locator('dd')).toContainText('€');

  await budgetRow.locator('.source-chip__summary').click();
  await expect(budgetRow.locator('.source-chip__link')).toHaveAttribute(
    'href',
    new RegExp(`^${sourced.source_url}`),
  );
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
