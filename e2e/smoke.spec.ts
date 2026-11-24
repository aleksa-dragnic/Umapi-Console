import { expect, test } from '@playwright/test';

// The smoke spec proves the e2e toolchain runs end to end: a built bundle, a
// served page, the mock answering it, and one assertion against what renders.
// An anonymous visitor at the root meets the landing page, and its call to
// action leads to sign-in (inventory section 3.14, ADR 0018).
test('the built bundle boots, shows the landing page, and Try the demo leads to sign-in', async ({
  page,
}) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'An admin console that does not hide HTTP' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Try the demo' }).click();

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
