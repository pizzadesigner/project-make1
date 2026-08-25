// L3: a module opened into the focus slot, and the other five standing aside in
// the rail. The places are worked out from boxes measured on the running page
// (widgetStack.js#focusPlaces), so what needs a browser is the part no fixture
// can stand in for — whether the arrangement still fits the region it is in.
//
// It did not, the first time. The rail's cards are held at a minimum scale, and
// a card kept at that floor stays wider than the rail was asked to be; placed by
// the rail's width rather than their own, the five hung over the edge of the
// screen and lost the end of every line. That is the check here.

import { test, expect } from '@playwright/test';

const CITY = '.marker[aria-label*="Köln"], .marker[aria-label*="Cologne"]';
// Both zoom transitions, then the module flight and its stagger, then the move
// into the slot.
const FOCUSED = 2500;
const SETTLED = 3200;
const OPENED = 1200;

/** Every module's box, and the region's, in page coordinates. */
function boxes(page) {
  return page.evaluate(() => {
    const region = document.querySelector('.widget-detail');
    const rect = region.getBoundingClientRect();
    return {
      region: { left: rect.left, right: rect.right },
      modules: [...document.querySelectorAll('.widget-detail__module')].map((module) => {
        const box = module.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          expanded: module.querySelector('.widget-detail__card').classList.contains('is-expanded'),
          pinned: module.getAttribute('style') !== null && module.style.left !== '',
        };
      }),
    };
  });
}

async function openFirstModule(page, criterion) {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await page.locator(CITY).first().click({ force: true });
  await page.waitForTimeout(FOCUSED);
  await page.locator(`.widget--${criterion}`).click({ force: true });
  await page.waitForTimeout(SETTLED);
  await page.locator('.widget-detail__card[data-module]').first().click({ force: true });
  await page.waitForTimeout(OPENED);
}

// Both sides, because the arrangement mirrors: the rail takes the side the
// modules flew out of, which is the left for Problem Fit and the right for
// Impact, and an off-by-one in the mirror only shows on one of them.
for (const criterion of ['problemFit', 'impact']) {
  test(`${criterion}: nothing in the focus arrangement crosses the region's edge`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openFirstModule(page, criterion);

    const { region, modules } = await boxes(page);
    expect(modules.filter((module) => module.expanded)).toHaveLength(1);
    for (const module of modules) {
      // A pixel of slack for sub-pixel rounding; the failure this guards against
      // was 16px, straight off the edge of the screen.
      expect(module.left, 'a card reaches past the region on the left').toBeGreaterThanOrEqual(
        region.left - 1,
      );
      expect(module.right, 'a card reaches past the region on the right').toBeLessThanOrEqual(
        region.right + 1,
      );
    }
  });
}

// The card is opened to be read, which is a different job from being glanced
// at in a column — so its small print steps up with it. Only a browser can say
// whether it did: the sizes come from two custom properties redefined on the
// card, and everything inside asks for them by name.
test('the opened card reads larger than the ones beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFirstModule(page, 'problemFit');

  const type = await page.evaluate(() => {
    const px = (node, sel) => {
      const found = node.querySelector(sel);
      return found ? Number.parseFloat(getComputedStyle(found).fontSize) : null;
    };
    const opened = document.querySelector('.widget-detail__card.is-expanded');
    const beside = [...document.querySelectorAll('.widget-detail__card[data-module]')].find(
      (card) => card !== opened,
    );
    const prose = opened.querySelector('.module__prose');
    return {
      openedLabel: px(opened, '.module__label'),
      besideLabel: px(beside, '.module__label'),
      openedProse: px(opened, '.module__prose'),
      besideProse: px(beside, '.module__prose'),
      proseWidth: prose.getBoundingClientRect().width,
      cardWidth: opened.getBoundingClientRect().width,
    };
  });

  expect(type.openedLabel).toBeGreaterThan(type.besideLabel);
  expect(type.openedProse).toBeGreaterThan(type.besideProse);
  // And the line length is held back, or the card would read worse the wider the
  // window got — which is the opposite of what opening it is for.
  expect(type.proseWidth).toBeLessThan(type.cardWidth * 0.95);
});

test('closing the slot hands the six back to their columns', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFirstModule(page, 'impact');
  expect((await boxes(page)).modules.every((module) => module.pinned)).toBe(true);

  await page.locator('.widget-detail__card.is-expanded .module__expand').click({ force: true });
  await page.waitForTimeout(OPENED);

  const { modules } = await boxes(page);
  expect(modules.some((module) => module.expanded)).toBe(false);
  // Positioned outright while they are away, and back in the flow afterwards —
  // a module left with its box written on it would never drift again, and the
  // next entrance would fly it from the wrong place.
  expect(modules.every((module) => module.pinned)).toBe(false);
  await expect(page.locator('.widget-detail.is-pinned')).toHaveCount(0);
});
