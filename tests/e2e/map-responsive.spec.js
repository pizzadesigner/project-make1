// The map has to be sized by the window, not by whatever the window was when it
// mounted. It wasn't: the projection, the viewBox and the city fit were all
// measured once at render and never again, so a window resized afterwards left
// the SVG letterboxing a stale frame — a city focused in a small window stayed
// fitted to that window and read as a speck on a country-scale map, with the
// wheel dead because zoom was gated off once a city was focused.
//
// Playwright is the only place this is visible: it needs a real layout, a real
// ResizeObserver and a real wheel gesture.
//
// Markers ripple forever and so never satisfy the actionability check; the
// clicks are forced for that reason alone.

import { test, expect } from '@playwright/test';

const CITY = '.marker[aria-label*="Köln"], .marker[aria-label*="Cologne"]';
// Long enough for both zoom transitions to land: the click frames the city at a
// regional fallback, then its districts arrive and it snaps to the real fit.
const SETTLED = 2500;

/** What the map is actually showing: the live zoom scale, the frame it is drawn
 * in, and how much of the stage the focused city's districts take up. */
async function mapState(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('.europe-map__svg');
    const districts = document.querySelector('.europe-map__districts').getBoundingClientRect();
    return {
      k: svg.__zoom.k,
      viewBox: svg.getAttribute('viewBox'),
      frame: { width: svg.clientWidth, height: svg.clientHeight },
      city: { width: districts.width, height: districts.height },
    };
  });
}

async function focusCity(page) {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await page.locator(CITY).first().click({ force: true });
  await page.waitForTimeout(SETTLED);
}

test('a focused city fills the stage on a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 700 });
  await focusCity(page);

  const state = await mapState(page);
  expect(state.viewBox).toBe(`0 0 ${state.frame.width} ${state.frame.height}`);
  // Was 60px of 760 before the widget reserve was capped.
  expect(state.city.width / state.frame.width).toBeGreaterThan(0.3);
});

test('resizing the window re-fits the map and the focused city', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await focusCity(page);
  const before = await mapState(page);

  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(SETTLED);
  const after = await mapState(page);

  // The frame follows the window instead of letterboxing a stale viewBox...
  expect(after.frame).toEqual({ width: 1600, height: 900 });
  expect(after.viewBox).toBe('0 0 1600 900');
  // ...and the city is re-fitted to it rather than merely scaled with it.
  expect(after.k).toBeGreaterThan(before.k);
  expect(after.city.width / after.frame.width).toBeGreaterThan(0.3);
});

test('the wheel still zooms once a city is focused', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await focusCity(page);
  const fitted = await mapState(page);

  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(500);
  const zoomedIn = await mapState(page);
  expect(zoomedIn.k).toBeGreaterThan(fitted.k);

  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(500);
  expect((await mapState(page)).k).toBeLessThan(zoomedIn.k);
});

test('reset returns to the overview from a manual zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await focusCity(page);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: /reset view|ansicht/i }).click();
  await page.waitForTimeout(SETTLED);
  expect((await mapState(page)).k).toBeCloseTo(1, 2);
});
