import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNT } from '../../src/lib/api/demo-account';
import { signInAsAdmin, signInAsDemo } from '../support';

// Draws docs/images: what the README shows, and the directory the landing page
// shows. See playwright.readme.config.ts.

const IMAGES = 'docs/images';

async function settled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );
  await page.evaluate(() => document.fonts.ready);
}

async function shoot(page: Page, name: string): Promise<void> {
  // A resting pointer would light up whatever row is under it.
  await page.mouse.move(0, 0);
  await settled(page);
  await page.screenshot({ path: `${IMAGES}/${name}.png` });
}

test('the landing page, as a new visitor meets it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Try the demo' })).toBeVisible();
  await expect(page.getByRole('img', { name: /user directory/ })).toBeVisible();
  await shoot(page, 'landing');
});

test('sign-in, with the demo account printed', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('region', { name: 'Demo account' })).toBeVisible();
  await shoot(page, 'sign-in');
});

test('the directory, as the demo account sees it', async ({ page }) => {
  await signInAsDemo(page, '/users');
  await expect(page.getByText(/^200 · \d+ results$/)).toBeVisible();
  await shoot(page, 'directory');
});

test("a user's detail, with its history", async ({ page }) => {
  // Tall enough for every panel: a full-page capture would draw the docked
  // inspector bar across the middle of the page.
  await page.setViewportSize({ width: 1440, height: 1500 });
  await signInAsDemo(page, '/users?q=reader');
  await page.getByRole('link', { name: DEMO_ACCOUNT.email }).click();
  await expect(page.getByRole('region', { name: 'History' }).getByText('Registered')).toBeVisible();
  await shoot(page, 'detail');
});

test('the inspector, showing a page read again answered 304', async ({ page }) => {
  await signInAsDemo(page, '/users');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();

  await page.getByRole('button', { name: 'Inspector' }).click();
  const newest = page.getByRole('list', { name: 'Requests' }).getByRole('button').first();
  await expect(newest).toContainText(/^304/);
  await shoot(page, 'inspector');
});

test('registering a user, as the administrator', async ({ page }) => {
  await signInAsAdmin(page, '/users');
  await page.getByRole('button', { name: 'Register a user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register a user' });
  await dialog.getByLabel('Email').fill('nova.korisnica@example.com');
  await dialog.getByLabel('First name').fill('Nova');
  await dialog.getByLabel('Last name').fill('Korisnica');
  await dialog.getByLabel('Password').fill('short');
  await dialog.getByRole('button', { name: 'Register' }).click();
  await expect(dialog.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
  await shoot(page, 'register');
});
