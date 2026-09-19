import { expect, test } from '@playwright/test';

// The smoke spec exists to prove the e2e toolchain runs end to end: a built
// bundle, a served page, and one assertion against what it renders. The real
// flows arrive with the screens they belong to.
test('the built bundle serves the application shell', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Umapi Console' })).toBeVisible();
});