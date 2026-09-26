import { expect, type Page } from '@playwright/test';

/**
 * Signs in with the demo account the sign-in screen prints, as a visitor
 * would, and waits for the page `next` names.
 */
export async function signInAsDemo(page: Page, next: string): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const demo = page.getByRole('region', { name: 'Demo account' });
  await page.getByLabel('Email').fill((await demo.locator('dd').nth(0).textContent()) ?? '');
  await page.getByLabel('Password').fill((await demo.locator('dd').nth(1).textContent()) ?? '');
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
