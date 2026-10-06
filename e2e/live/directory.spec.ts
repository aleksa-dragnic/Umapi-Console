import { expect, test, type Request } from '@playwright/test';

import { DEMO_ACCOUNT } from '../../src/lib/api/demo-account';
import { signInAsDemo } from '../support';
import { isLogout } from './support';

// The seeded directory as the demo account meets it in production (bridge
// section 7): more than one page, a page read again answering 304 to the
// console's origin (row 82 measured it locally), a search that finds a name
// with a diacritic (rows 67, 73), and the read-only boundary - every write
// disabled with its reason, and activating one sends nothing (bridge section 5,
// check 5). One sign-in for all of it: three calls of the auth limit.

const results = (status: number) => new RegExp(`^${status} · (\\d+) results?$`);

test('the directory pages, answers 304 when read again, and the demo account sends no write', async ({
  page,
}) => {
  await signInAsDemo(page, '/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  const footer = page.getByText(/^\d{3} · \d+ results?$/);
  await expect(footer).toHaveText(results(200));
  const total = Number(results(200).exec((await footer.textContent()) ?? '')?.[1]);
  const pages = page.getByText(/^Page 1 of \d+$/);
  await expect(pages).toBeVisible();
  const count = Number(/of (\d+)$/.exec((await pages.textContent()) ?? '')?.[1]);
  expect(count).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL('/users?page=2');
  await expect(page.getByText(`Page 2 of ${count}`)).toBeVisible();

  // Read before with its tag, so read again conditionally: the API confirms
  // it unchanged, and the browser hands the 304 to this origin.
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page).toHaveURL('/users');
  await expect(footer).toHaveText(`304 · ${total} results`);

  // Search folds diacritics on the API (ADR 0020 there): the plain term finds
  // the name as it is written.
  await page.getByLabel('Search').fill('petrovic');
  await expect(page).toHaveURL('/users?q=petrovic');
  await expect(footer).toHaveText(results(200));
  await expect(
    page
      .getByRole('main')
      .getByText(/Petrović/)
      .first(),
  ).toBeVisible();

  await page.getByLabel('Search').fill('reader');
  await expect(page).toHaveURL('/users?q=reader');
  await page.getByRole('link', { name: DEMO_ACCOUNT.email }).click();
  await expect(page.getByRole('heading', { level: 1, name: DEMO_ACCOUNT.email })).toBeVisible();
  // The detail has settled once its tag is shown. The API makes strong tags
  // (row 44) and the edge weakened them when it compressed (row 22); on
  // 2026-10-06 production served this one strong. The console shows a tag
  // exactly as received (ADR 0013), so either form is accepted here.
  await expect(page.getByRole('region', { name: 'Concurrency' })).toContainText(/ETag(W\/)?"/);

  const held = 'This account holds users.read, roles.read.';
  const writes = [
    { name: 'Edit', reason: `Requires users.write. ${held}` },
    { name: 'Lock', reason: `Requires users.lock. ${held}` },
    { name: 'Assign role', reason: `Requires roles.manage. ${held}` },
    { name: 'Remove Member', reason: `Requires roles.manage. ${held}` },
  ];
  for (const { name, reason } of writes) {
    const control = page.getByRole('button', { name });
    await expect(control).toHaveAttribute('aria-disabled', 'true');
    await expect(control).toHaveAccessibleDescription(reason);
  }

  // Every way of activating each control, while every request to the API is
  // recorded. aria-disabled keeps the control focusable for its reason, so the
  // pointer click is forced past Playwright's own enabled check.
  const sent: string[] = [];
  const record = (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) sent.push(`${request.method()} ${url.pathname}`);
  };
  page.on('request', record);
  for (const { name } of writes) {
    const control = page.getByRole('button', { name });
    await control.click({ force: true });
    await control.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
  }
  await page.waitForTimeout(1_000);
  page.off('request', record);
  expect(sent).toEqual([]);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const logout = page.waitForResponse(isLogout);
  await page.getByRole('button', { name: 'Sign out' }).click();
  expect((await logout).status()).toBe(204);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
