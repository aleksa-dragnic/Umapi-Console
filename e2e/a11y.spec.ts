import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { MOCK_ACCOUNTS } from '../src/lib/testing/factories';
import { signInAsAdmin, signInAsDemo } from './support';

// Gate 5: zero accessibility violations on every route, measured by axe-core in
// a real browser against WCAG 2.1 A and AA. Every screen is checked in the
// state a visitor meets first, and the two overlays - the inspector and a
// dialog - open.

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map(
    ({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`,
  );
}

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

  await page.goto(`/users/${MOCK_ACCOUNTS.demo.id}`);
  await expect(page.getByRole('region', { name: 'Concurrency' })).toContainText('W/');
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

test('a dialog open', async ({ page }) => {
  await signInAsAdmin(page, `/users/${MOCK_ACCOUNTS.demo.id}`);
  await page.getByRole('button', { name: 'Assign role' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('combobox')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
