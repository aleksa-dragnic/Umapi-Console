import { expect, test } from '@playwright/test';

// Sign-in as a visitor meets it: the demo account printed on the screen, typed
// into the form, and the address that was asked for honoured afterwards
// (inventory sections 3.2 and 5).
test('the printed demo account signs in and returns to the requested page', async ({ page }) => {
  await page.goto('/sign-in?next=%2F');

  const demo = page.getByRole('region', { name: 'Demo account' });
  const email = (await demo.locator('dd').nth(0).textContent()) ?? '';
  const password = (await demo.locator('dd').nth(1).textContent()) ?? '';
  expect(email).toContain('@');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The root is the directory (build plan decision 1).
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(page).toHaveURL(/\/users$/);
});

test('a wrong password is refused with the one message the inventory allows', async ({ page }) => {
  await page.goto('/sign-in');

  await page.getByLabel('Email').fill('demo@umapi.local');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
});
