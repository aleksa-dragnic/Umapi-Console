import { expect, test, type Page } from '@playwright/test';

import { setRefreshRace, signInAsDemo } from './support';

// Gate 3: the refresh race renders both outcomes (inventory section 3.9,
// build plan section 6.1). Two refreshes with one cookie, sent by the session
// screen on purpose. Live, the API answered the 409 three rounds out of three
// (observed row 11); the 401 is the mock's other outcome, set before the race.

const SESSION = '/session';

async function race(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Race two refreshes' }).click();
  await expect(page.getByText(/If the API treats the second request as a replay/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
}

test('a 409 leaves the session running and says why', async ({ page }) => {
  await signInAsDemo(page, SESSION);
  await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
  await setRefreshRace(page, 'conflict');

  await race(page);

  await expect(page.getByRole('status')).toHaveText(
    'The API refused the second request because the first had just rotated the token. Nothing was revoked; your session continues.',
  );
  // Both answers are in the inspector: the winner's 200 and the loser's 409.
  await page.getByRole('button', { name: 'Inspector' }).click();
  const requests = page.getByRole('list', { name: 'Requests' }).getByRole('button');
  await expect(requests.filter({ hasText: /^200.*POST\/api\/v1\/auth\/refresh/ })).toHaveCount(1);
  await expect(requests.filter({ hasText: /^409.*POST\/api\/v1\/auth\/refresh/ })).toHaveCount(1);
  await expect(page).toHaveURL(SESSION);
  await expect(page.getByText(/^Expires in/)).toBeVisible();

  // The winner's cookie stands: a reload restores the session.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
});

test('a reused refresh token ends the session at once with the reuse wording', async ({ page }) => {
  await signInAsDemo(page, SESSION);
  await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
  await setRefreshRace(page, 'reuse');

  await race(page);

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'This session was ended because a refresh token was used twice. Every session of this account has been revoked.',
  );
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(SESSION)}`);

  // Every session was revoked: a reload does not restore it.
  await page.reload();
  await expect(page.getByRole('form', { name: 'Sign in' })).toBeVisible();
});
