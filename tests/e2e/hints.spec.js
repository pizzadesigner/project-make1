// The floating hint box: a source chip's citation, a link's hostname, a card's
// info point (hintLayer.js).
//
// These used to open where they stood, inside the card. Two of their ancestors
// scroll — the L2 region always, and an opened L3 card — and a scroll container
// clips its descendants wherever inside it they are. Measured at 1440x900 that
// cost a modal-split citation 204px of itself and a funding link 61px, while at
// 1920 nothing clipped at all, which is what made it look occasional rather than
// structural. Only a browser can show it: it needs real layout at a real size.

import { test, expect } from '@playwright/test';

const CITY = '.marker[aria-label*="Köln"], .marker[aria-label*="Cologne"]';
const FOCUSED = 2500;
const SETTLED = 3200;
const OPENED = 1400;

async function openCriterion(page, criterion) {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await page.locator(CITY).first().click({ force: true });
  await page.waitForTimeout(FOCUSED);
  await page.locator(`.widget--${criterion}`).click({ force: true });
  await page.waitForTimeout(SETTLED);
  // Landed, not merely time elapsed: a hint is placed against the box of the
  // anchor it belongs to, and a card still flying is a card at the wrong size
  // in the wrong place. Under a parallel run the wait above is not always
  // enough on its own.
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

/** How far the open box falls outside the viewport, on its worst edge. */
function boxOverflow(page) {
  return page.evaluate(() => {
    const box = document.querySelector('.hint-layer');
    if (!box || box.hidden) return null;
    const b = box.getBoundingClientRect();
    return Math.round(
      Math.max(b.right - window.innerWidth, -b.left, b.bottom - window.innerHeight, -b.top),
    );
  });
}

/** Hover every hint anchor in the region and report the worst overflow.
 *
 * The box is filled and placed synchronously on hover, so this waits for it to
 * be showing rather than for the fade to finish — what is measured is geometry,
 * and there are enough anchors here that a fixed pause per hover adds up to most
 * of a test timeout. */
async function worstOverflow(page) {
  const anchors = page.locator('.widget-detail [data-hint]');
  const box = page.locator('.hint-layer');
  const count = await anchors.count();
  expect(count).toBeGreaterThan(0);
  let worst = null;
  for (let i = 0; i < count; i += 1) {
    await anchors.nth(i).hover({ force: true });
    await expect(box).toBeVisible();
    const past = await boxOverflow(page);
    if (past !== null) worst = Math.max(worst ?? past, past);
  }
  expect(worst, 'no hint opened at all').not.toBeNull();
  return worst;
}

// 1440x900 on purpose: the size the clipping was measured at. At 1920 there is
// room to spare and every arrangement passes whatever the box is anchored to.
test('every hint opens fully on screen, at both layers', async ({ page }) => {
  // Two full arrangements, every anchor in each, at two layers: legitimately
  // long, and long enough to reach the default timeout under a parallel run.
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCriterion(page, 'adoption');

  expect(await worstOverflow(page), 'a hint fell off screen at L2').toBeLessThanOrEqual(0);

  await page.locator('.widget-detail__card[data-module]').first().click({ force: true });
  await page.waitForTimeout(OPENED);
  expect(await worstOverflow(page), 'a hint fell off screen at L3').toBeLessThanOrEqual(0);
});

test('the hint closes when the region scrolls out from under it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCriterion(page, 'adoption');

  await page.locator('.widget-detail [data-hint]').first().hover({ force: true });
  await expect(page.locator('.hint-layer')).toBeVisible();

  // The box is fixed to the viewport; the anchor is not. Following would mean
  // pointing at whatever scrolled into its place.
  await page.locator('.widget-detail').evaluate((region) => region.scrollBy(0, 120));
  await page.waitForTimeout(200);
  await expect(page.locator('.hint-layer')).toBeHidden();
});

test('a keyboard opens the hint and Escape dismisses it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCriterion(page, 'impact');

  const info = page.locator('.widget-detail__card[data-module="car"] .module__info');
  await info.focus();
  await expect(page.locator('.hint-layer')).toBeVisible();

  // WCAG 1.4.13: dismissable without moving the pointer. Escape still steps back
  // a layer when no hint is open, so the region must survive this one.
  await page.keyboard.press('Escape');
  await expect(page.locator('.hint-layer')).toBeHidden();
  await expect(page.locator('.widget-detail')).toBeVisible();
});
