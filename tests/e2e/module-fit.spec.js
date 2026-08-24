// A module is as tall as what it holds. It used to be as tall as its own width
// times 4/3 — height derived from the column, content expected to fit whatever
// that came to — and across the three widgets it did not: at the design width
// four of the eighteen modules were squeezed below the height their content
// wanted, the worst by 155px, and at 1440x900 fifteen of them were, the worst
// by 353px. Some of that was a scrollbar (the funding list), some a chart
// quietly shrinking (the donut), some text cut off.
//
// Only a browser can show this: it needs real layout, real fonts and the real
// content, which is why there is no unit-test equivalent. The check is the same
// one for every module rather than a table of expected heights — a height
// written down here would have to be updated every time a source is added, and
// would test the fixture rather than the rule.

import { test, expect } from '@playwright/test';

const CITY = '.marker[aria-label*="Köln"], .marker[aria-label*="Cologne"]';
const CRITERIA = ['problemFit', 'impact', 'adoption'];
// Both zoom transitions, then the module flight and its stagger.
const FOCUSED = 2500;
const SETTLED = 3200;

/** Every module in the open region, with the height it has and the height its
 * content wants. Measured by lifting the height constraint and reading the card
 * back — the same way the box would grow if anything inside it needed more. */
async function moduleFit(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.widget-detail__module')].map((module) => {
      const card = module.querySelector('.widget-detail__card');
      const actual = Math.round(card.getBoundingClientRect().height);

      // Anything scrolling inside the card is content the reader cannot see
      // without finding a scrollbar, which is the same failure as a clip.
      const scrolling = [...card.querySelectorAll('*')]
        .filter((el) => el.clientHeight > 0 && el.scrollHeight - el.clientHeight > 1)
        .map((el) => String(el.className).split(' ')[0]);

      const before = card.getAttribute('style') ?? '';
      card.style.height = 'auto';
      card.style.overflow = 'visible';
      void card.offsetHeight;
      const wanted = Math.round(card.getBoundingClientRect().height);
      card.setAttribute('style', before);

      return {
        label: card.querySelector('.module__label')?.textContent?.trim() ?? '(unlabelled)',
        actual,
        wanted,
        scrolling,
      };
    }),
  );
}

async function openWidget(page, criterion) {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await page.locator(CITY).first().click({ force: true });
  await page.waitForTimeout(FOCUSED);
  await page.locator(`.widget--${criterion}`).click({ force: true });
  await page.waitForTimeout(SETTLED);
  await expect(page.locator('.widget-detail__module')).toHaveCount(6);
}

for (const criterion of CRITERIA) {
  test(`${criterion}: no module is shorter than what it holds`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openWidget(page, criterion);

    for (const module of await moduleFit(page)) {
      // A pixel of slack for sub-pixel rounding; the failures this guards
      // against were 19px and up.
      expect(module.wanted - module.actual, `${module.label} is cut short`).toBeLessThanOrEqual(1);
      expect(module.scrolling, `${module.label} hides content behind a scrollbar`).toEqual([]);
    }
  });
}

// The old box got worse the narrower the column was, because height came from
// width. Nothing derives one from the other now, so a smaller window makes the
// modules taller (text wraps more) rather than shorter.
test('modules still fit their content on a narrower window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWidget(page, 'adoption');

  for (const module of await moduleFit(page)) {
    expect(module.wanted - module.actual, `${module.label} is cut short`).toBeLessThanOrEqual(1);
    expect(module.scrolling, `${module.label} hides content behind a scrollbar`).toEqual([]);
  }
});

// The arrangement is still three staggered columns, and the columns are what
// carry it now that no two modules share a row band.
test('the three columns hold 3, 2 and 1 modules and stay staggered', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWidget(page, 'impact');

  const columns = page.locator('.widget-detail__column');
  await expect(columns).toHaveCount(3);
  const counts = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.querySelectorAll('.widget-detail__module').length),
  );
  expect(counts).toEqual([3, 2, 1]);

  const [first, second] = await columns.evaluateAll((nodes) =>
    nodes.slice(0, 2).map((node) => node.getBoundingClientRect().top),
  );
  // The middle column sits below the outer one by --module-column-offset.
  expect(second - first).toBeGreaterThan(50);
});
