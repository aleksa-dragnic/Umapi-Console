import { expect, test, type Page } from '@playwright/test';

// The specimen route is where tokens and primitives are reviewed (ADR 0005), so
// it is the one page whose screenshots catch a regression without the false
// positives of whole-screen snapshots (#64). One screenshot per section, per
// density, so a failure names the component.
const SECTIONS = [
  'AppMark',
  'Badge',
  'Button',
  'Card',
  'CodeWindow',
  'ColdStartNotice',
  'Dialog',
  'EntityStatus',
  'Input',
  'RateLimitNotice',
  'Select',
  'SkeletonRow',
  'StatusDot',
  'Table',
] as const;

const DENSITIES = ['Application density', 'Editorial density'] as const;

// Vite compiles the specimen on its first request, which on a cold runner
// takes longer than any single test should wait.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/_design');
  await expect(page.getByRole('heading', { level: 1, name: 'Design specimen' })).toBeVisible({
    timeout: 60_000,
  });
  await page.close();
});

test.beforeEach(async ({ page }) => {
  // The rate-limit notices count down a second at a time from when they mount.
  // The clock is fake from the start but runs until the page has rendered -
  // paused before that, nothing on the page would ever start - and then stops
  // a quarter of a second later, well before the first tick, so every notice
  // shows its starting value. Checked below, so a slow machine fails here, not
  // as a screenshot of the wrong second.
  await page.clock.install({ time: new Date('2026-11-24T12:00:00Z') });
  await page.goto('/_design');
  await expect(page.getByRole('heading', { level: 1, name: 'Design specimen' })).toBeVisible({
    timeout: 30_000,
  });
  await pauseSoon(page);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText('Try again in 42 seconds.').first()).toBeVisible();
});

/** Pauses the fake clock just ahead of now; retried if now moved past it first. */
async function pauseSoon(page: Page): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    const now = await page.evaluate(() => Date.now());
    try {
      await page.clock.pauseAt(new Date(now + 250));
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

for (const density of DENSITIES) {
  for (const section of SECTIONS) {
    test(`${density}: ${section}`, async ({ page }) => {
      const gallery = page.locator('div[data-density]', {
        has: page.getByRole('heading', { level: 2, name: density }),
      });
      const specimen = gallery.getByRole('region', { name: section, exact: true });

      await expect(specimen).toHaveScreenshot(
        `${density.split(' ')[0]!.toLowerCase()}-${section.toLowerCase()}.png`,
      );
    });
  }
}
