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

// The L1 → L2 path the note above was waiting on: a widget is the affordance,
// and its detail arrives as a set of modules standing in the half of the screen
// the map has just vacated. Unit tests cover the mount and the teardown; what
// only a browser can show is that the modules actually travel into place, and
// that none of them reaches over the map.
test('opening a widget stands its modules in the freed half', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await page.locator(`.marker[aria-label*="${sourced.city_display}"]`).click({ force: true });

  const widget = page.locator('.widget--impact');
  await expect(widget).toBeVisible();
  await widget.click();

  const region = page.locator('.widget-detail');
  await expect(region).toBeVisible();
  const modules = page.locator('.widget-detail__module');
  await expect(modules).toHaveCount(6);

  // Mid-entrance: sampled rather than read once, so a module that jump-cut to
  // its final position would still fail here.
  const offsets = await modules.first().evaluate(async (node) => {
    const seen = [];
    for (let i = 0; i < 6; i += 1) {
      seen.push(getComputedStyle(node).transform);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    return seen;
  });
  expect(offsets.some((transform) => transform !== 'none' && !transform.endsWith('0, 0)'))).toBe(
    true,
  );

  // Three staggered columns: the second column's boxes sit between the first
  // column's, and the third column's single box is level with the last of the
  // first. Read once everything has landed.
  //
  // "Level" is deliberately approximate. Each module sits up to --module-nudge
  // off the line the grid put it on so the arrangement does not read as ruled,
  // which is a design decision and not drift: the tolerance below is twice that
  // nudge, and anything past it means the grid placement itself has moved.
  const NUDGE_TOLERANCE = 24;
  // Wait for the arrangement to have landed, not merely to be visible. Opacity
  // reaches 1 at the flight's 25% mark (see the module-fly keyframes), so
  // waiting on that measured six modules still travelling and read their
  // in-flight positions as their places. Asked of the animations themselves
  // rather than by sleeping for the duration, and filtered by name: the idle
  // drift on the same elements never finishes.
  await page.waitForFunction(() => {
    const parts = [...document.querySelectorAll('.widget-detail__module, .widget-detail__card')];
    return (
      parts.length > 0 &&
      parts.every((part) =>
        part
          .getAnimations()
          .filter((each) => String(each.animationName).startsWith('module-fly'))
          .every((each) => each.playState === 'finished'),
      )
    );
  });
  const box = async (n) => modules.nth(n).boundingBox();
  const [one, two, three, four, six] = await Promise.all([box(0), box(1), box(2), box(3), box(5)]);

  // Which way "along the columns" runs depends on the side the region is on: a
  // right-hand region mirrors, so its first column is the rightmost one and the
  // arrangement reads right to left (see .widget-detail--right). Impact is a
  // right-hand widget, so asserting a left-to-right order here was asserting
  // the mirror away.
  const rightHanded = await region.evaluate((node) =>
    node.classList.contains('widget-detail--right'),
  );
  const along = (near, far) =>
    rightHanded ? expect(far.x).toBeLessThan(near.x) : expect(far.x).toBeGreaterThan(near.x);
  along(one, four);
  along(four, six);

  expect(four.y).toBeGreaterThan(one.y);
  expect(four.y).toBeLessThan(two.y);
  expect(Math.abs(six.y - three.y)).toBeLessThanOrEqual(NUDGE_TOLERANCE);

  // And no two of them sit on exactly the same line, which is the point of the
  // nudge — a perfectly ruled column would put these three at one x.
  const columnOne = await Promise.all([box(0), box(1), box(2)]);
  expect(new Set(columnOne.map((each) => Math.round(each.x))).size).toBeGreaterThan(1);

  // And no scrollbar. The nudge and the idle drift both reach past the cells
  // the grid measured, so the region has to keep room for them — it grew a
  // scrollbar over 9px of decoration once already.
  const overflow = await region.evaluate((node) => ({
    y: node.scrollHeight - node.clientHeight,
    x: node.scrollWidth - node.clientWidth,
  }));
  expect(overflow.y).toBeLessThanOrEqual(0);
  expect(overflow.x).toBeLessThanOrEqual(0);

  // The arrows wait for the modules. They are drawn only once every module has
  // landed — the whole point of hanging their delay off the entrance — so a
  // line that is already on screen mid-flight means that timing has come apart.
  const arrows = page.locator('.connector__line');
  await expect(arrows).toHaveCount(2);
  await expect
    .poll(async () => arrows.first().evaluate((node) => getComputedStyle(node).strokeDashoffset), {
      timeout: 5000,
    })
    .toBe('0px');
  const heads = page.locator('.connector__head');
  await expect(heads).toHaveCount(2);
  await expect(heads.first()).toHaveCSS('opacity', '1');
  await expect(heads.nth(1)).toHaveCSS('opacity', '1');

  // The head is what draws the line, so once the draw is over it has to be
  // sitting on the tip — not near it, and not still on its way there. Measured
  // against the line's own end point, which is the thing it is supposed to
  // track; the tolerance is the head's own size, since a bounding box centre is
  // not quite the point the path carries it by.
  const offTip = await page.evaluate(() => {
    const line = document.querySelector('.connector__line');
    const head = document.querySelector('.connector__head');
    const tip = line.getPointAtLength(line.getTotalLength());
    const svg = line.ownerSVGElement.getBoundingClientRect();
    const box = head.getBoundingClientRect();
    return Math.hypot(
      svg.x + tip.x - (box.x + box.width / 2),
      svg.y + tip.y - (box.y + box.height / 2),
    );
  });
  expect(offTip).toBeLessThan(8);

  // The map keeps clear of the modules rather than running under them. Before
  // the L2 anchor was pulled towards the edge the two overlapped by ~90px on
  // this stage, so the modules stood on top of the city instead of beside it.
  const clearance = await page.evaluate(() => {
    const el = document.querySelector('.widget-detail');
    const region = el.getBoundingClientRect();
    const city = document
      .querySelector('.europe-map__districts, .europe-map__city')
      .getBoundingClientRect();
    return el.classList.contains('widget-detail--left')
      ? city.left - region.right
      : region.left - city.right;
  });
  expect(clearance).toBeGreaterThan(0);

  // The map owns the other half: no module may reach across into it.
  const regionBox = await region.boundingBox();
  expect(six.x + six.width).toBeLessThanOrEqual(regionBox.x + regionBox.width + 1);
  expect(one.x).toBeGreaterThanOrEqual(regionBox.x - 1);
});

// The hard rule (CLAUDE.md): asking for reduced motion must leave the content in
// its final position, motionless. The components carry no branch for it — the
// tokens go to 0 and the same CSS resolves to no movement — so this is the check
// that the wiring actually reaches the browser.
test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a widget opens with its modules already in place', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.marker');
    await page.locator(`.marker[aria-label*="${sourced.city_display}"]`).click({ force: true });
    await page.locator('.widget--impact').click();

    // Read immediately: under the entrance these would be mid-flight.
    // The transform resolves to the identity matrix rather than the `none`
    // keyword — a 0ms animation still applies its final frame — which is the
    // same thing: the module is carrying no offset.
    const module = page.locator('.widget-detail__module').first();
    await expect(module).toHaveCSS('opacity', '1');
    await expect(module).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  });
});

test('a shared deep link loads the city cold, silhouette and sourced budget', async ({ page }) => {
  await page.goto(`/#/city/${sourced.city}`);

  // Non-ASCII in the title is deliberate: UTF-8 has to survive CSV → slug → URL
  // → render (CLAUDE.md), and the fixtures that used to cover it left with Žilina.
  await expect(page.locator('.city-header__title')).toHaveText(sourced.project_title);
  await expect(page.locator('.city-silhouette__district').first()).toBeVisible();

  // A figure and the source behind it, together — the Honesty objective's whole
  // claim. The chip is the link now rather than a control that reveals one, so
  // the href is on it from the start and reaching the source is a single press.
  const budgetRow = page.locator('.facts__row', { hasText: 'Budget' }).first();
  await expect(budgetRow.locator('dd')).toContainText('€');

  const chip = budgetRow.locator('.source-chip');
  await expect(chip).toHaveAttribute('href', new RegExp(`^${sourced.source_url}`));
  await expect(chip).toHaveAttribute('target', '_blank');
  // It names its destination without being opened, hovered or clicked.
  await expect(chip).toHaveAttribute('aria-label', new RegExp(sourced.source_label, 'i'));

  // The citation is on the chip, hidden until it is wanted, and shown by a
  // keyboard focus as readily as by a pointer.
  const hint = chip.locator('.link-hint');
  await expect(hint).toHaveText(new RegExp(sourced.source_label, 'i'));
  await expect(hint).toBeHidden();
  await chip.focus();
  await expect(hint).toBeVisible();
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
