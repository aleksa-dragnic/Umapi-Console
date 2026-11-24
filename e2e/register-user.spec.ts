import { expect, test } from '@playwright/test';

import { signInAsAdmin, signInAsDemo } from './support';

// Registering a user (inventory section 3.13, #82): the administrator registers
// from the directory, by keyboard, and lands on the new user's detail; the
// demo account meets the control disabled, with the permission it needs.

const EMAIL = 'nova.korisnica@example.com';

test('the administrator registers a user by keyboard and lands on the detail', async ({ page }) => {
  await signInAsAdmin(page, '/users');
  await page.getByRole('button', { name: 'Register a user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register a user' });
  await expect(dialog.getByLabel('Email')).toBeFocused();

  // Enter in a field submits the form: the Register button sits in the dialog's
  // footer, outside the form, and is tied to it by its form attribute.
  await dialog.getByLabel('Password').fill('short');
  await dialog.getByLabel('Password').press('Enter');
  await expect(dialog.getByLabel('Email')).toBeFocused();
  await expect(dialog.getByLabel('Email')).toHaveAccessibleDescription('Enter an email address.');

  await dialog.getByLabel('Email').fill(EMAIL);
  await dialog.getByLabel('First name').fill('Nova');
  await dialog.getByLabel('Last name').fill('Korisnica');
  await dialog.getByLabel('Password').fill('Dobra-Lozinka-1');
  await dialog.getByLabel('Password').press('Enter');

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: EMAIL })).toBeVisible();

  await page.goBack();
  await page.getByLabel('Search').fill('korisnica');
  await expect(page.getByRole('link', { name: EMAIL })).toBeVisible();
});

test('the demo account meets Register disabled, with the permission it needs', async ({ page }) => {
  await signInAsDemo(page, '/users');
  const control = page.getByRole('button', { name: 'Register a user' });
  await expect(control).toHaveAttribute('aria-disabled', 'true');
  await expect(control).toHaveAccessibleDescription(/^Requires users\.write\./);
  // That activating it opens nothing is a unit test (RegisterUserDialog.test.tsx).
});
