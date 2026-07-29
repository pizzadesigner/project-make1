// Stepping back from a focused city must leave the marker looking exactly as it
// did before — and must not strand a focus ring on a user who never reached for
// the keyboard. See releaseMarkerFocus() in components/europeMap.js.
//
// The marker ripples animate forever, so the elements never satisfy Playwright's
// stability check; every click here is forced for that reason alone.

import { test, expect } from '@playwright/test';

const RESTING_R = '7px'; // .marker__pin at rest; :hover/:focus-visible/.is-focused raise it to 9px
const AWAY = { x: 1270, y: 710 }; // parking spot for the pointer, clear of every marker

/** Computed radius of the given marker's pin, which is what "stays bigger" means. */
function pinRadius(page, label) {
  return page
    .locator(`.marker[aria-label*="${label}"] .marker__pin`)
    .evaluate((pin) => getComputedStyle(pin).r);
}

function activeIsMarker(page) {
  return page.evaluate(() => document.activeElement?.classList?.contains('marker') ?? false);
}

/** Tab until a marker takes focus, so the browser treats the selection as
 * keyboard-driven (which is what makes :focus-visible match). */
async function tabToMarker(page) {
  for (let i = 0; i < 12; i += 1) {
    if (await activeIsMarker(page)) return true;
    await page.keyboard.press('Tab');
  }
  return activeIsMarker(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.marker');
});

test('Escape returns a mouse-selected marker to its resting size', async ({ page }) => {
  const marker = page.locator('.marker').first();
  const label = await marker.getAttribute('aria-label');

  await marker.click({ force: true });
  await page.mouse.move(AWAY.x, AWAY.y);
  await expect.poll(() => pinRadius(page, label)).toBe('9px'); // focused: enlarged on purpose

  await page.keyboard.press('Escape');

  await expect.poll(() => pinRadius(page, label)).toBe(RESTING_R);
  expect(await activeIsMarker(page)).toBe(false);
});

test('the Back control returns a mouse-selected marker to its resting size', async ({ page }) => {
  const marker = page.locator('.marker').first();
  const label = await marker.getAttribute('aria-label');

  await marker.click({ force: true });
  await page.locator('[data-back]').click({ force: true });
  await page.mouse.move(AWAY.x, AWAY.y);

  await expect.poll(() => pinRadius(page, label)).toBe(RESTING_R);
});

test('Escape keeps focus on a keyboard-selected marker so navigation can continue', async ({
  page,
}) => {
  await page.mouse.move(AWAY.x, AWAY.y);
  expect(await tabToMarker(page)).toBe(true);
  const label = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));

  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  // The keyboard user keeps their place, focus ring and all — unlike the mouse
  // user above, for whom that ring would appear out of nowhere.
  expect(await activeIsMarker(page)).toBe(true);
  await expect.poll(() => pinRadius(page, label)).toBe('9px');
});
