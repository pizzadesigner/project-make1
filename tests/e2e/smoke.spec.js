import { test, expect } from '@playwright/test';

test('map → Bern shows the budget and a working source link', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.marker');
  await expect(page.locator('.marker')).toHaveCount(9);

  await page.locator('.marker[aria-label*="Bern"]').click();
  await expect(page).toHaveURL(/#\/city\/bern$/);

  const budget = page.locator('.facts__row', { hasText: 'Budget' }).locator('dd').first();
  await expect(budget).toContainText('€');

  await page.locator('.source-chip__summary').first().click();
  await expect(page.locator('.source-chip__link').first()).toHaveAttribute('href', /^https?:\/\//);
});

test('a shared deep link loads the city cold', async ({ page }) => {
  await page.goto('/#/city/zilina');
  await expect(page.locator('.city-header__title')).toContainText('Cyklochodníky');
  await expect(page.locator('.city-silhouette__shape')).toBeVisible();
});

test('the list view is a sortable equivalent of the map', async ({ page }) => {
  await page.goto('/#/list');
  await expect(page.locator('.project-table tbody tr')).toHaveCount(9);

  // Sorting by budget reorders rows and announces the sort via aria-sort.
  await page.getByRole('button', { name: 'Budget' }).click();
  const budgetHeader = page.locator('th', { has: page.getByRole('button', { name: 'Budget' }) });
  await expect(budgetHeader).toHaveAttribute('aria-sort', 'ascending');

  // A city link routes to the detail view.
  await page.getByRole('link', { name: 'Bern' }).click();
  await expect(page).toHaveURL(/#\/city\/bern$/);
});
