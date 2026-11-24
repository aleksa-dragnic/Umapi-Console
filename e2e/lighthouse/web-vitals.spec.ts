import { writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import lighthouse from 'lighthouse';

import { DEBUGGING_PORT } from '../../playwright.lighthouse.config';
import { signInAsDemo } from '../support';

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
// Which element was the largest paint, and what its time was spent on: the
// first thing to read when a budget is missed.
const lcpOf: Record<string, unknown> = {};

function lcpElement(lhr: { audits: Record<string, { details?: unknown }> }): unknown {
  const details = lhr.audits['largest-contentful-paint-element']?.details as
    | { items?: { items?: { node?: { snippet?: string }; phase?: string; timing?: number }[] }[] }
    | undefined;
  return {
    element: details?.items?.[0]?.items?.[0]?.node?.snippet,
    phases: details?.items?.[1]?.items?.map(({ phase, timing }) => ({ phase, timing })),
  };
}

test.afterAll(() => {
  writeFileSync(
    'test-results/lighthouse/web-vitals.json',
    JSON.stringify({ measured: results, largestPaint: lcpOf }, null, 2),
  );
});

test('sign-in, the directory and a user detail stay within their Web Vitals budgets', async ({
  page,
  baseURL,
}) => {
  // The session is the browser's, so the screens behind the login are measured
  // signed in: the demo account, as a visitor signs in. Lighthouse loads each
  // page afresh and the console restores the session from its cookie.
  await signInAsDemo(page, '/users');
  const detail = await page.getByRole('row').nth(1).getByRole('link').first().getAttribute('href');
  expect(detail).not.toBeNull();

  const screens = { 'sign-in': '/sign-in', directory: '/users', detail: detail! };

  for (const [name, path] of Object.entries(screens)) {
    const run = await lighthouse(`${baseURL}${path}`, {
      port: DEBUGGING_PORT,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      // Keep the session: Lighthouse clears storage before a run by default.
      disableStorageReset: true,
    });
    const audits = run!.lhr.audits;
    const measured = Object.fromEntries(
      Object.keys(BUDGET).map((id) => [id, audits[id]!.numericValue ?? Number.NaN]),
    ) as Measured;
    results[name] = measured;
    lcpOf[name] = lcpElement(run!.lhr);

    for (const [id, limit] of Object.entries(BUDGET) as [keyof typeof BUDGET, number][]) {
      expect.soft(measured[id], `${name}: ${id}`).toBeLessThanOrEqual(limit);
    }
  }
});
