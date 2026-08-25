// The city zoom must actually animate in the *production* build. It didn't: the
// CSS minifier rewrites `480ms` to `.48s`, and reading that as a bare number
// gave a 0.48ms transition — a jump cut, not a zoom. Playwright runs against
// `vite preview`, so this is the only place that regression is visible.
//
// Markers ripple forever and so never satisfy the actionability check; the click
// is forced for that reason alone.

import { test, expect } from '@playwright/test';

const FOCUS_ZOOM = 5; // FOCUS_ZOOM in europeMap.js — where the first transition heads

// Long enough to cover the transition itself (--motion-slow, 280ms) *and*
// however long Playwright takes to resolve and dispatch the click. The window
// opens before the click, so those two are spent from the same budget: at 300ms
// the click alone consumed most of it, the sampler saw a scale of 1 throughout,
// and the test failed against a zoom that was animating perfectly well.
//
// A longer window costs nothing in strictness. What is asserted is that the
// scale passes through the middle, and a jump cut has no middle to pass through
// however long it is watched for.
const WINDOW_MS = 1200;

/** Sample the zoom layer's scale every frame, so a transition is visible as
 * intermediate values rather than a single jump. */
async function recordZoomScale(page, ms) {
  await page.evaluate(() => {
    window.__zoomSamples = [];
    const layer = document.querySelector('.europe-map__zoom');
    const tick = () => {
      const k = /scale\(([-\d.]+)\)/.exec(layer.getAttribute('transform') || '')?.[1];
      window.__zoomSamples.push(k ? Number(k) : 1);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(ms);
  return page.evaluate(() => window.__zoomSamples);
}

test('clicking a city animates the zoom instead of jumping', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await page.mouse.move(1270, 710);

  const samplesPromise = recordZoomScale(page, WINDOW_MS);
  await page.locator('.marker').first().click({ force: true });
  const samples = await samplesPromise;

  // A real transition passes through the middle; the bug went 1 → 5 in one frame.
  //
  // The upper bound is what isolates the movement under test. The city's own
  // geometry loads asynchronously and re-fits the map far past 5 when it
  // arrives, so anything at or above FOCUS_ZOOM belongs to that second
  // transition — and with the jump cut, every sample after the first frame does.
  // Keeping the ceiling below it is what makes a jump cut fail here.
  //
  // The floor is low because the first transition is eased and may be
  // interrupted by that re-fit while it is still early: measured, it can be cut
  // off around 1.05, so a floor at 1.05 threw away every sample it had. What has
  // to be true is that the scale was interpolated at all, and values a few
  // thousandths above 1 say so as well as values near the middle do.
  const midFlight = samples.filter((k) => k > 1.0005 && k < FOCUS_ZOOM - 0.05);
  expect(
    midFlight.length,
    `expected intermediate zoom scales between 1 and ${FOCUS_ZOOM}, saw: ${[...new Set(samples)].join(', ')}`,
  ).toBeGreaterThan(2);
});
