// The milestone line is drawn to scale, and that is the one claim about it a
// unit test cannot make: the spacing is solved against the height of wrapped SVG
// text at the card's real width (milestoneChart.js#stepFor), so it only exists
// once there is a browser laying the text out.
//
// Two things are checked, and they are the same claim from both ends. Every year
// in the range is on the line exactly once — as a mark if something happened in
// it, as a tick if nothing did — and the whole set sits on one arithmetic
// sequence. Together those say the line is a scale rather than a list: the four
// years the project stalled after the 2016 council decision take four times the
// room 2023→2024 does, and can be counted off the ticks instead of worked out by
// subtracting two labels.

import { test, expect } from '@playwright/test';

const CITY = '.marker[aria-label*="Köln"], .marker[aria-label*="Cologne"]';
const FOCUSED = 2500;
const SETTLED = 3200;
const OPENED = 1200;

/** Every position on the line, in viewBox units: the marks with their years, and
 * the ticks for the years between them. */
function line(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('.milestones');
    const round = (value) => Math.round(Number(value) * 10) / 10;
    return {
      ticks: [...svg.querySelectorAll('.milestones__tick')].map((tick) =>
        round(tick.getAttribute('y1')),
      ),
      marks: [...svg.querySelectorAll('.milestones__year')].map((group) => ({
        year: Number(group.querySelector('.milestones__when').textContent),
        y: round(group.querySelector('.milestones__mark').getAttribute('cy')),
      })),
    };
  });
}

test('the milestone line is a scale, not a list', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.waitForSelector('.marker');
  await page.locator(CITY).first().click({ force: true });
  await page.waitForTimeout(FOCUSED);
  await page.locator('.widget--problemFit').click({ force: true });
  await page.waitForTimeout(SETTLED);
  await page.locator('.widget-detail__card[data-module="milestones"]').click({ force: true });
  await page.waitForTimeout(OPENED);

  const { ticks, marks } = await line(page);
  expect(marks.map((mark) => mark.year)).toEqual([2015, 2016, 2019, 2022, 2023, 2024]);

  // Every year from the first to the last is on the line exactly once. Six of
  // them carry a milestone, so the other four are ticks — and a tick landing on
  // a marked year, or a year going missing altogether, both show up here.
  const first = marks[0].year;
  const last = marks[marks.length - 1].year;
  const positions = [...marks.map((mark) => mark.y), ...ticks].sort((a, b) => a - b);
  expect(positions).toHaveLength(last - first + 1);
  expect(ticks).toHaveLength(last - first + 1 - marks.length);

  // And they sit on one arithmetic sequence, which is what "to scale" means
  // here: one year is worth the same distance everywhere on the line. Compared
  // against the first step rather than a fixed number, because how many pixels a
  // year is worth depends on the text and the card's width — that it is the same
  // everywhere does not.
  const steps = positions.slice(1).map((y, index) => y - positions[index]);
  for (const step of steps) expect(step).toBeCloseTo(steps[0], 1);

  // The stall is the thing the card is for: 2016 to 2019 has to be three times
  // 2023 to 2024, not one list row against another.
  const at = (year) => marks.find((mark) => mark.year === year).y;
  expect(at(2019) - at(2016)).toBeCloseTo(3 * (at(2024) - at(2023)), 1);
});
