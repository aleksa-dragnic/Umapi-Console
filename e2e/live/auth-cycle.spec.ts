import { expect, test } from '@playwright/test';

import { DEMO_ACCOUNT } from '../../src/lib/api/demo-account';
import { signInAsDemo } from '../support';
import { COLD_START_MS, isLogin, isLogout, isRefresh } from './support';

// One full auth cycle on the deployed pair (bridge section 7): the boot
// refresh refused without a cookie, a sign-in that sets it, a reload of the
// deepest route restored by the cookie alone, and a sign-out that clears it.
// Five calls of the auth limit.

test('sign in sets the cookie, a reload is restored by it, and sign out clears it', async ({
  page,
  context,
}) => {
  const boot = page.waitForResponse(isRefresh, { timeout: COLD_START_MS });
  const login = page.waitForResponse(isLogin, { timeout: COLD_START_MS });
  await signInAsDemo(page, '/users?q=reader');
  expect((await boot).status()).toBe(401);
  const signedIn = await login;
  expect(signedIn.status()).toBe(200);

  // The attributes only: the value is a credential and is never asserted or
  // printed. Host-only (no leading dot), on the API's own host (section 3.2).
  const cookies = (await context.cookies()).filter((cookie) => cookie.name === 'umapi_rt');
  expect(cookies).toHaveLength(1);
  const cookie = cookies[0];
  if (cookie === undefined) throw new Error('No umapi_rt cookie after sign-in.');
  expect({
    domain: cookie.domain,
    path: cookie.path,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  }).toEqual({
    domain: new URL(signedIn.url()).hostname,
    path: '/api/v1/auth',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });
  // Max-Age is the refresh token's remaining lifetime, seven days (decision 11).
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(6 * 24 * 60 * 60);

  await page.getByRole('link', { name: DEMO_ACCOUNT.email }).click();
  const heading = page.getByRole('heading', { level: 1, name: DEMO_ACCOUNT.email });
  await expect(heading).toBeVisible();
  await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}$/);
  const detail = page.url();

  // The refresh carries nothing but the cookie, so a 200 here is the cookie
  // travelling from the console's origin to the API's (row 86).
  const restored = page.waitForResponse(isRefresh);
  await page.reload();
  expect((await restored).status()).toBe(200);
  await expect(heading).toBeVisible();
  await expect(page).toHaveURL(detail);

  const logout = page.waitForResponse(isLogout);
  await page.getByRole('button', { name: 'Sign out' }).click();
  expect((await logout).status()).toBe(204);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await context.cookies()).filter((c) => c.name === 'umapi_rt')).toHaveLength(0);

  const refused = page.waitForResponse(isRefresh);
  await page.reload();
  expect((await refused).status()).toBe(401);
  await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
});
