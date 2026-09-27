import { expect, test, type Page } from '@playwright/test';

import { signInAsDemo } from './support';

// The directory keeps its whole state in the address bar (inventory sections
// 3.3 and 5): a search, a filter, a sort and a page survive a reload, Back
// steps through them, and a changed filter goes back to page 1 (Gate 4).

const results = (page: Page) => page.getByText(/^\d{3} · \d+ results?$/);

test('a search goes back to page 1, and a reload keeps the whole view', async ({ page }) => {
  await signInAsDemo(page, '/users?page=2');
  await expect(page.getByText('Page 2 of 13')).toBeVisible();

  await page.getByLabel('Search').fill('ovic');

  await expect(page).toHaveURL('/users?q=ovic');
  await expect(results(page)).toHaveText('200 · 30 results');

  await page.getByLabel('Status').selectOption('Active');
  await page.getByRole('button', { name: 'Last name' }).click();
  await expect(page).toHaveURL('/users?q=ovic&sort=lastName%3Aasc&status=active');

  await page.reload();

  await expect(page.getByLabel('Search')).toHaveValue('ovic');
  await expect(page.getByLabel('Status')).toHaveValue('Active');
  await expect(page.getByRole('columnheader', { name: 'Last name' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

test('Back steps through the view, and a page read again answers 304 (section 2.9)', async ({
  page,
}) => {
  await signInAsDemo(page, '/users');
  await expect(results(page)).toHaveText('200 · 130 results');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL('/users?page=2');
  await expect(page.getByText('Page 2 of 13')).toBeVisible();
  await page.getByRole('button', { name: 'Last name' }).click();
  await expect(page).toHaveURL('/users?sort=lastName%3Aasc');
  await page.getByLabel('Status').selectOption('Active');
  await expect(page).toHaveURL('/users?sort=lastName%3Aasc&status=active');

  await page.goBack();
  await expect(page).toHaveURL('/users?sort=lastName%3Aasc');
  await expect(page.getByLabel('Status')).toHaveValue('');
  await expect(page.getByRole('columnheader', { name: 'Last name' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );

  await page.goBack();
  await expect(page).toHaveURL('/users?page=2');
  await expect(page.getByText('Page 2 of 13')).toBeVisible();
  // Read before, so read again with its tag: the API confirms it unchanged.
  await expect(results(page)).toHaveText('304 · 130 results');

  await page.goBack();
  await expect(page).toHaveURL('/users');
  await expect(page.getByText('Page 1 of 13')).toBeVisible();
});

test('a search with no match repeats the term as sent, and clears', async ({ page }) => {
  await signInAsDemo(page, '/users');
  await expect(results(page)).toHaveText('200 · 130 results');

  await page.getByLabel('Search').fill('Marko Petrović');

  await expect(page.getByText('No users match "Marko Petrović".')).toBeVisible();
  await expect(results(page)).toHaveText('200 · 0 results');

  await page.getByRole('button', { name: 'Clear search' }).click();

  await expect(page).toHaveURL('/users');
  // The unfiltered view was read first, so reading it again is confirmed: 304.
  await expect(results(page)).toHaveText('304 · 130 results');
});
