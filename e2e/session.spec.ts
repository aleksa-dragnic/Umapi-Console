import { expect, test } from '@playwright/test';

import { DEMO_ACCOUNT } from '../src/lib/api/demo-account';
import { signInAsDemo } from './support';

// Gate 3: a signed-in user who reloads never meets the sign-in form, and a user
// who signs out is not signed back in by a reload (inventory sections 2.4 and
// 3.1). The protected route is a user's detail, the deepest route the console
// has, reached the way a user reaches it: by opening a row of the directory.

test('a reload restores the session without ever mounting the sign-in form', async ({ page }) => {
  await signInAsDemo(page, '/users?q=reader');
  await page.getByRole('link', { name: DEMO_ACCOUNT.email }).click();
  const heading = page.getByRole('heading', { level: 1, name: DEMO_ACCOUNT.email });
  await expect(heading).toBeFocused();
  await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}$/);
  const detail = page.url();

  // Installed before any script of the reloaded page runs, so a form that
  // mounts for a single frame and is replaced is still seen.
  await page.addInitScript(() => {
    const seen = { signIn: false };
    Object.assign(window, { __umapiSignInSeen: seen });
    new MutationObserver(() => {
      if (document.querySelector('form[aria-label="Sign in"]') !== null) seen.signIn = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();

  await expect(heading).toBeVisible();
  await expect(page.getByRole('region', { name: 'Concurrency' })).toContainText('W/');
  await expect(page).toHaveURL(detail);
  const seen = await page.evaluate(
    () => (window as unknown as { __umapiSignInSeen: { signIn: boolean } }).__umapiSignInSeen,
  );
  expect(seen.signIn).toBe(false);
});

test('signing out ends the session, and a reload does not restore it', async ({ page }) => {
  await signInAsDemo(page, '/');
  await expect(page.getByRole('heading', { name: 'Umapi Console' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.reload();
  await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
