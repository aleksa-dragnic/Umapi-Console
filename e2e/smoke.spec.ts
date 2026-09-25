import { expect, test } from '@playwright/test';

// The smoke spec proves the e2e toolchain runs end to end: a built bundle, a
// served page, the mock answering it, and one assertion against what renders.
// An anonymous visitor at the root is sent to sign-in (inventory section 3.1).
test('the built bundle boots and sends an anonymous visitor to sign-in', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
