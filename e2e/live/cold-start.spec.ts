import { expect, test } from '@playwright/test';

import { COLD_START_MS, isRefresh } from './support';

// The cold-start state (inventory section 2.1), asserted rather than waited
// out (bridge section 7): an idle instance cannot be had on demand, so the
// boot refresh is held in the browser for longer than the 1200 ms threshold
// and then sent to the real API, whose answer ends the wait. One call of the
// auth limit.

const COLD_START = /^Waking the API\./;

test('a slow first answer shows the cold-start line until the real answer arrives', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/refresh', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    }
    await route.continue();
  });

  const refresh = page.waitForResponse(isRefresh, { timeout: COLD_START_MS });
  await page.goto('/users');

  await expect(page.getByText(COLD_START)).toBeVisible();
  expect((await refresh).status()).toBe(401);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText(COLD_START)).toHaveCount(0);
});
