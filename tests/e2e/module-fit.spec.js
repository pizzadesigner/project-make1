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
// How many cards each criterion opens into. Adoption is five: four in two
// columns and the timeline spanning both below them.
const CARDS = { problemFit: 6, impact: 6, adoption: 5 };
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
      //
      // Only boxes that can actually scroll count. An element whose overflow is
      // visible has no scrollbar for anything to hide behind — its content
      // simply paints outside it.
      //
      // Nor does a box of a single pixel, which is the visually-hidden idiom
      // rather than a viewport onto anything: every .link-hint is one, holding
      // the citation a screen reader reads while the floating box draws it.
      const scrolling = [...card.querySelectorAll('*')]
        .filter((el) => el.clientHeight > 1 && el.clientWidth > 1)
        .filter((el) => el.scrollHeight - el.clientHeight > 1)
        .filter((el) => {
          const { overflowY, overflowX } = getComputedStyle(el);
          return overflowY !== 'visible' || overflowX !== 'visible';
        })
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
  await expect(page.locator('.widget-detail__module')).toHaveCount(CARDS[criterion]);
  await waitForLanded(page);
}

/** The region needs no scrollbar to show what it holds. It grew one over 9px of
 * decoration once: a module sits off the line the columns put it on and drifts a
 * few px afterwards, and both reach past the cells that were measured.
 *
 * Sideways always: the columns are capped, so the only thing that can push the
 * arrangement wider than the region is that decoration. Vertically only where
 * the content fits to begin with — a criterion whose cards are simply taller
 * than the region scrolls for them by design, and that is content rather than
 * decoration. */
async function expectFits(page, { vertical = true } = {}) {
  const overflow = await page.locator('.widget-detail').evaluate((node) => ({
    y: node.scrollHeight - node.clientHeight,
    x: node.scrollWidth - node.clientWidth,
  }));
  expect(overflow.x, 'the region scrolls sideways').toBeLessThanOrEqual(0);
  if (vertical) expect(overflow.y, 'the region scrolls vertically').toBeLessThanOrEqual(0);
}

/** Wait for the entrance to be over, not merely for the clock to run out.
 *
 * A module flies in from the clicked widget at that widget's width and shrinks
 * to its own, so a card measured mid-flight is a card measured at the wrong
 * size — and under a parallel run the fixed waits above are not always enough.
 * Asked of the animations themselves, filtered by name: the idle drift on the
 * same elements never finishes. (Same wait as smoke.spec.js, for the same
 * reason.) */
async function waitForLanded(page) {
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

// Problem Fit is the last criterion on the staggered arrangement — three
// columns holding 3, 2 and 1. Impact and Adoption have their own, below.
test('the three columns hold 3, 2 and 1 modules and stay staggered', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWidget(page, 'problemFit');

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

// Impact stands its six in two columns of three instead. The 3/2/1 stagger left
// the sixth card alone in a column, which read as a leftover rather than as the
// last of a set — and two columns leave room for the cards to be wider, which
// the charts in this criterion are the ones that want.
test('impact stands its six in two columns of three, wider and without arrows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWidget(page, 'impact');

  const columns = page.locator('.widget-detail__column');
  await expect(columns).toHaveCount(2);
  const counts = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.querySelectorAll('.widget-detail__module').length),
  );
  expect(counts).toEqual([3, 3]);

  // Wider than the three-column arrangement gives, and capped well short of the
  // 488px two columns would take if they split the region between them — the
  // strip they do not need goes back to the map.
  const width = await page
    .locator('.widget-detail__card')
    .first()
    .evaluate((card) => card.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(320);
  expect(width).toBeLessThanOrEqual(400);

  // Six separate measurements: a modal split and a count of cyclists are not two
  // ends of a line, so nothing is drawn between them.
  await expect(page.locator('.connector__line')).toHaveCount(0);

  // And the whole arrangement fits its region, decoration included — the nudge
  // and the idle drift both reach past the cells the columns measured.
  await expectFits(page);

  // The middle column keeps its half step down.
  const [first, second] = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().top),
  );
  expect(second - first).toBeGreaterThan(50);
});

// Adoption is five cards, not six: two columns of two, and the timeline below
// them across the width of both. A timeline runs along its long axis, so the
// widest place in the arrangement is the one that suits it.
test('adoption stands four in two columns with the timeline spanning below', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWidget(page, 'adoption');

  const columns = page.locator('.widget-detail__column');
  await expect(columns).toHaveCount(2);
  const counts = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.querySelectorAll('.widget-detail__module').length),
  );
  expect(counts).toEqual([2, 2]);

  const span = page.locator('.widget-detail__module--span');
  await expect(span).toHaveCount(1);
  const [spanBox, columnBox] = await Promise.all([
    span.boundingBox(),
    columns.first().boundingBox(),
  ]);
  // Wider than a column, and below both of them.
  expect(spanBox.width).toBeGreaterThan(columnBox.width * 1.8);
  expect(spanBox.y).toBeGreaterThan(columnBox.y + columnBox.height - 1);

  // Five separate requirements in no particular order: nothing joins them.
  await expect(page.locator('.connector__line')).toHaveCount(0);
  // Sideways only: the Politik card's recommendations make this arrangement
  // taller than the region, which it scrolls for.
  await expectFits(page, { vertical: false });
});
