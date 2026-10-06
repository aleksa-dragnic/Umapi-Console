import { expect, test } from '@playwright/test';

import { DEMO_ACCOUNT } from '../src/lib/api/demo-account';
import { signInAsAdmin, signInAsDemo } from './support';

// A user's detail as the two accounts meet it (inventory sections 3.3, 3.4
// and 3.6): the administrator writes and the directory follows; the demo
// account sees every write disabled with its reason.

test('a lock is confirmed, and Back returns to the row, selected and showing it', async ({
  page,
}) => {
  await signInAsAdmin(page, '/users?q=reader');
  await page.getByRole('link', { name: DEMO_ACCOUNT.email }).click();
  await expect(page.getByRole('heading', { level: 1, name: DEMO_ACCOUNT.email })).toBeFocused();

  await page.getByRole('button', { name: 'Lock' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lock Demo Reader' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Lock' }).click();

  await expect(dialog).toBeHidden();
  const identity = page.getByRole('region', { name: 'Identity' });
  await expect(identity).toContainText('Locked');
  await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL('/users?q=reader');
  const link = page.getByRole('link', { name: DEMO_ACCOUNT.email });
  await expect(link).toBeFocused();
  const row = page.getByRole('row').filter({ has: link });
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(row).toContainText('Locked');
  // The lock moved the page's tag (row 25): the read after it is a 200, not a 304.
  await expect(page.getByText('200 · 1 result')).toBeVisible();
});

test('the demo account meets every write disabled, with the permission it needs', async ({
  page,
}) => {
  await signInAsDemo(page, '/users?q=reader');
  await page.getByRole('link', { name: DEMO_ACCOUNT.email }).click();

  const held = 'This account holds users.read, roles.read.';
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveAccessibleDescription(
    `Requires users.write. ${held}`,
  );
  await expect(page.getByRole('button', { name: 'Lock' })).toHaveAccessibleDescription(
    `Requires users.lock. ${held}`,
  );
  await expect(page.getByRole('button', { name: 'Assign role' })).toHaveAccessibleDescription(
    `Requires roles.manage. ${held}`,
  );
  // aria-disabled rather than disabled, so the reason stays reachable by
  // keyboard; that nothing is sent when it is activated is a unit test.
  for (const name of ['Edit', 'Lock', 'Assign role', 'Remove Member']) {
    await expect(page.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
  }

  // Nothing was written, so the directory read again is confirmed unchanged.
  await page.goBack();
  await expect(page.getByText('304 · 1 result')).toBeVisible();
});

test('the demo account reads why Remove is disabled, whole, at desktop width', async ({ page }) => {
  // The roles table kept every cell on one line, so the reason under Remove
  // ran past the card and the table scrolled sideways even at full width
  // (found in the README's screenshots, step 6). At 380px it may still scroll.
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAsDemo(page, '/users?q=reader');
  await page.getByRole('link', { name: DEMO_ACCOUNT.email }).click();

  const roles = page.getByRole('table', { name: 'Roles' });
  await expect(roles.getByRole('button', { name: 'Remove Member' })).toBeVisible();
  const scroller = roles.locator('xpath=..');
  const overflow = await scroller.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBe(0);
});
