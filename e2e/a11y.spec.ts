import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { MOCK_ACCOUNTS } from '../src/lib/testing/factories';
import { coldStartOnLoad, respondOnce, signInAsAdmin, signInAsDemo } from './support';

// Row 92: a browser gets the strong tag, a quoted SHA-256 in base64url.
const STRONG_TAG = /"[\w-]{43}"/;

// Gate 5: zero accessibility violations, measured by axe-core in a real browser
// against WCAG 2.2 A and AA. Every screen in the state a visitor meets first,
// every dialog, the inspector, and the states a visitor meets when something
// goes wrong: the boot screen, the error boundary, an empty result, a failed
// read, a 429, a conflict - and the main screens at a phone's width.

async function violations(page: Page): Promise<string[]> {
  // Screens fade in (`animate-enter`). Measured mid-fade, text is still partly
  // transparent and fails contrast - Firefox showed it - so the page is measured
  // as it settles, not as it arrives. An animation cancelled on the way - its
  // element replaced by the next render - rejects `finished`; that is settled too.
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(
    ({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`,
  );
}

const DETAIL = `/users/${MOCK_ACCOUNTS.demo.id}`;

test('sign-in and 404, without a session', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('every screen behind the login, and the inspector open', async ({ page }) => {
  await signInAsDemo(page, '/users');
  await expect(page.getByText('200 · 130 results')).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.goto(DETAIL);
  await expect(page.getByRole('region', { name: 'Concurrency' })).toContainText(STRONG_TAG);
  expect(await violations(page)).toEqual([]);

  await page
    .getByRole('navigation', { name: 'Console' })
    .getByRole('link', { name: 'Roles' })
    .click();
  await expect(page.getByRole('cell', { name: 'Administrator', exact: true })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page
    .getByRole('navigation', { name: 'Console' })
    .getByRole('link', { name: 'Session' })
    .click();
  await expect(page.getByText(/^Expires in/)).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Inspector' }).click();
  await expect(page.getByRole('list', { name: 'Requests' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('every dialog open: assign, remove, lock, unlock', async ({ page }) => {
  await signInAsAdmin(page, DETAIL);
  const dialog = page.getByRole('dialog');

  await page.getByRole('button', { name: 'Assign role' }).click();
  await expect(dialog.getByRole('combobox')).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Remove Member' }).click();
  await expect(dialog).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Lock' }).click();
  await expect(dialog).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Lock' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(dialog).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the boot screen while the API wakes', async ({ page }) => {
  await signInAsDemo(page, '/users');
  await coldStartOnLoad(page, 5000);
  await page.reload();

  await expect(page.getByRole('main', { name: 'Checking the session' })).toBeVisible();
  await expect(page.getByText(/^Waking the API/)).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the error boundary', async ({ page }) => {
  await signInAsDemo(page, '/users');
  await expect(page.getByText('200 · 130 results')).toBeVisible();
  // A detail without its roles breaks the screen, as an unexpected body would.
  await respondOnce(
    page,
    'GET',
    '/api/v1/users/:id',
    200,
    {},
    {
      'Content-Type': 'application/json',
    },
  );
  await page.getByRole('link', { name: MOCK_ACCOUNTS.admin.email }).click();

  await expect(page.getByText('Something in the console failed to render.')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the directory empty, failed and rate limited', async ({ page }) => {
  await signInAsDemo(page, '/users');
  await expect(page.getByText('200 · 130 results')).toBeVisible();

  await page.getByLabel('Search').fill('nobody-matches-this');
  await expect(page.getByText('No users match "nobody-matches-this".')).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await respondOnce(page, 'GET', '/api/v1/users', 503, {
    status: 503,
    title: 'Service Unavailable',
  });
  await page.getByLabel('Search').fill('ovic');
  await expect(page.getByRole('alert')).toContainText('503 Service Unavailable');
  expect(await violations(page)).toEqual([]);

  await respondOnce(
    page,
    'GET',
    '/api/v1/users',
    429,
    { status: 429, title: 'Too Many Requests' },
    { 'Retry-After': '30' },
  );
  await page.getByLabel('Search').fill('ovi');
  await expect(page.getByRole('alert')).toContainText('429');
  expect(await violations(page)).toEqual([]);
});

test('a conflict on the detail', async ({ page }) => {
  await signInAsAdmin(page, DETAIL);
  await respondOnce(page, 'POST', '/api/v1/users/:id/lock', 412, {
    status: 412,
    title: 'Precondition Failed',
    detail: 'The user was changed after the version given in If-Match. Read it again and retry.',
    errorCode: 'User.VersionMismatch',
  });

  await page.getByRole('button', { name: 'Lock' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lock' }).click();

  await expect(page.getByRole('region', { name: 'Conflict' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('sign-in, the directory and the detail at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/sign-in');
  await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await signInAsDemo(page, '/users');
  await expect(page.getByText('200 · 130 results')).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.goto(DETAIL);
  await expect(page.getByRole('region', { name: 'Concurrency' })).toContainText(STRONG_TAG);
  expect(await violations(page)).toEqual([]);
});
