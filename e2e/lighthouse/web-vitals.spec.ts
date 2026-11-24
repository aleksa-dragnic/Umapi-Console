import { writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

import { DEBUGGING_PORT } from '../../playwright.lighthouse.config';

// Lab Web Vitals on Lighthouse's default mobile profile (simulated slow 4G and
// a four times slower CPU), against the budgets in #63. Lab numbers on a shared
// runner move between runs, so the budgets are the thresholds of "good" Core
// Web Vitals rather than today's values: a regression past them is a real one.
const BUDGET = {
  'largest-contentful-paint': 2500,
  'cumulative-layout-shift': 0.1,
  'total-blocking-time': 200,
} as const;

type Measured = Record<keyof typeof BUDGET, number>;

const results: Record<string, Measured> = {};

test.afterAll(() => {
  writeFileSync('test-results/lighthouse/web-vitals.json', JSON.stringify(results, null, 2));
});

test('sign-in, the directory and a user detail stay within their Web Vitals budgets', async ({
  browser,
  baseURL,
}) => {
  expect(browser.isConnected()).toBe(true);

  // One tab for everything. Lighthouse otherwise opens a tab of its own, and
  // the mock keeps its session per tab (src/lib/testing/persistence.ts): in a
  // new tab the screens behind the login were never reached, and each run
  // measured the redirect to sign-in instead (#76 records the correction).
  // Lighthouse navigates a Puppeteer page it is given, so the sign-in happens
  // in that page, and every measurement after it keeps the session.
  const shared = await puppeteer.connect({ browserURL: `http://127.0.0.1:${DEBUGGING_PORT}` });
  const tab = await shared.newPage();

  async function measure(name: string, path: string): Promise<void> {
    const run = await lighthouse(
      `${baseURL}${path}`,
      {
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance'],
        // Keep the session: Lighthouse clears storage before a run by default.
        disableStorageReset: true,
      },
      undefined,
      tab,
    );
    const lhr = run!.lhr;

    // The page measured is the page asked for, not a redirect away from it.
    expect(new URL(lhr.finalDisplayedUrl).pathname, `${name}: the page Lighthouse measured`).toBe(
      new URL(path, baseURL).pathname,
    );

    const measured = Object.fromEntries(
      Object.keys(BUDGET).map((id) => [id, lhr.audits[id]!.numericValue ?? Number.NaN]),
    ) as Measured;
    results[name] = measured;

    for (const [id, limit] of Object.entries(BUDGET) as [keyof typeof BUDGET, number][]) {
      expect.soft(measured[id], `${name}: ${id}`).toBeLessThanOrEqual(limit);
    }
  }

  // Sign-in first, as a visitor meets it: signed in, it would send them on.
  await measure('sign-in', '/sign-in');

  // Then sign in, in the same tab, with the demo account the screen prints.
  await tab.goto(`${baseURL}/sign-in?next=%2Fusers`, { waitUntil: 'networkidle0' });
  // The section the screen names "Demo account", read as a visitor reads it.
  const [email, password] = await tab.$$eval('section', (sections) => {
    const demo = sections.find(
      (section) => section.querySelector('h2')?.textContent?.trim() === 'Demo account',
    );
    return [...(demo?.querySelectorAll('dd') ?? [])].map((cell) => cell.textContent ?? '');
  });
  await tab.type(
    '#' + (await tab.$eval('label::-p-text(Email)', (label) => label.htmlFor)),
    email!,
  );
  await tab.type(
    '#' + (await tab.$eval('label::-p-text(Password)', (label) => label.htmlFor)),
    password!,
  );
  await Promise.all([
    tab.waitForFunction(() => window.location.pathname === '/users'),
    tab.click('button[type="submit"]'),
  ]);
  const detail = await tab.waitForSelector('table tbody tr a', { timeout: 15_000 });
  const detailPath = await detail!.evaluate((link) =>
    link instanceof HTMLAnchorElement ? link.pathname : '',
  );

  await measure('directory', '/users');
  await measure('detail', detailPath);

  await tab.close();
  await shared.disconnect();
});
