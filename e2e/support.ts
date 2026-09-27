import { expect, type Page } from '@playwright/test';

import { MOCK_ACCOUNTS } from '../src/lib/testing/factories';

/**
 * Signs in with the demo account the sign-in screen prints, as a visitor
 * would, and waits for the page `next` names.
 */
export async function signInAsDemo(page: Page, next: string): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const demo = page.getByRole('region', { name: 'Demo account' });
  const email = (await demo.locator('dd').nth(0).textContent()) ?? '';
  const password = (await demo.locator('dd').nth(1).textContent()) ?? '';
  await submitSignIn(page, { email, password }, next);
}

/**
 * Signs in as the mock's administrator, who holds every permission (row 48).
 * The password is the mock's own and exists only in the `e2e` build.
 */
export async function signInAsAdmin(page: Page, next: string): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await submitSignIn(page, MOCK_ACCOUNTS.admin, next);
}

async function submitSignIn(
  page: Page,
  account: { email: string; password: string },
  next: string,
): Promise<void> {
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(next);
}

/**
 * The mock's scenario controls, which the `e2e` build places on the page
 * (`src/lib/testing/browser.ts`, ADR 0012). The scenario resets on reload, so
 * this is called after the page has loaded.
 */
export async function setRefreshRace(page: Page, outcome: 'conflict' | 'reuse'): Promise<void> {
  await page.evaluate((race) => {
    const mock = (window as unknown as { __umapiMock?: { setRefreshRace: (o: string) => void } })
      .__umapiMock;
    if (mock === undefined) throw new Error('The e2e build did not expose the mock controls.');
    mock.setRefreshRace(race);
  }, outcome);
}
