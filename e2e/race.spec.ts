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
  await expect(page.getByText(/^Request [12]: 409 Concurrency\.Conflict$/)).toBeVisible();
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
