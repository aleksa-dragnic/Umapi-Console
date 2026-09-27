import { expect, test, type Page } from '@playwright/test';

import { signInAsDemo } from './support';

// Gate 5 in the browser: the inspector records what the page sends, a 304 is
// shown rather than absorbed (inventory sections 2.9 and 3.8), and Copy as curl
// puts no credential in the clipboard.

function inspector(page: Page) {
  return page.getByRole('region', { name: 'Inspector' });
}

test('the directory read is in the inspector, and a page read again shows its 304 with no body', async ({
  page,
}) => {
  await signInAsDemo(page, '/users');
  await expect(inspector(page)).toContainText('GET/api/v1/users');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 of 13')).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByText('Page 1 of 13')).toBeVisible();

  const toggle = page.getByRole('button', { name: 'Inspector' });
  await toggle.click();
  const newest = page.getByRole('list', { name: 'Requests' }).getByRole('button').first();
  await expect(newest).toHaveAttribute('aria-current', 'true');
  await expect(newest).toContainText(/^304.*GET\/api\/v1\/users/);
  await expect(inspector(page).locator('figure').nth(1)).toContainText(
    'No body: a 304 carries none',
  );

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('Copy as curl leaves the token out of the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signInAsDemo(page, '/users');
  await expect(inspector(page)).toContainText('GET/api/v1/users');

  await page.getByRole('button', { name: 'Inspector' }).click();
  await page.getByRole('button', { name: 'Copy as curl' }).click();
  await expect(inspector(page).getByRole('status')).toContainText('Copied.');

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("curl -X GET '");
  expect(copied).toContain(`-H 'authorization: Bearer '"$TOKEN"`);
  // An access token is a JWT: three dot-separated base64url segments.
  expect(copied).not.toMatch(/[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/);
});
