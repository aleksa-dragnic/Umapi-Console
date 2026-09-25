import { expect, test, type Page } from '@playwright/test';

// Gate 3: a signed-in user who reloads never meets the sign-in form, and a user
// who signs out is not signed back in by a reload (inventory sections 2.4 and
// 3.1). The protected route here is `/` with a query string, the deepest route
// that exists before the user detail arrives; the query proves the whole
// address survives the reload, not only the path.

const PROTECTED = '/?view=reload';

async function signInAsDemo(page: Page, next: string): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const demo = page.getByRole('region', { name: 'Demo account' });
  await page.getByLabel('Email').fill((await demo.locator('dd').nth(0).textContent()) ?? '');
  await page.getByLabel('Password').fill((await demo.locator('dd').nth(1).textContent()) ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Umapi Console' })).toBeVisible();
}

test('a reload restores the session without ever mounting the sign-in form', async ({ page }) => {
  await signInAsDemo(page, PROTECTED);
  await expect(page).toHaveURL(PROTECTED);

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

  await expect(page.getByRole('heading', { name: 'Umapi Console' })).toBeVisible();
  await expect(page).toHaveURL(PROTECTED);
  const seen = await page.evaluate(
    () => (window as unknown as { __umapiSignInSeen: { signIn: boolean } }).__umapiSignInSeen,
  );
  expect(seen.signIn).toBe(false);
});

test('signing out ends the session, and a reload does not restore it', async ({ page }) => {
  await signInAsDemo(page, '/');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.reload();
  await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
