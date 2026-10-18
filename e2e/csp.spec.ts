import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { MOCK_ACCOUNTS } from '../src/lib/testing/factories';

// `vite preview` does not read public/_headers, so nothing else runs the
// console under its own policy. Here the policy from that file is put on the
// page's document, and a session in the browser - sign-in, the directory, a
// detail, the inspector, the session screen, all in one document - must cause
// no violation of it.
//
// Two directives make room for the mock and nothing else. Production forbids
// workers (`worker-src 'none'`) and every Trusted Types policy (`trusted-types
// 'none'`), because mockServiceWorker.js ships in dist and must never run
// there. This build runs the mock in exactly that worker, and registering it is
// a Trusted Types sink, so the spec allows workers from 'self' and a default
// policy that passes that one URL and refuses everything else.

const MOCK_WORKER = '/mockServiceWorker.js';

function policy(): string {
  const file = readFileSync(resolve(process.cwd(), 'public', '_headers'), 'utf8');
  const line = file
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith('Content-Security-Policy:'));
  if (line === undefined) throw new Error('public/_headers sends no Content-Security-Policy.');
  const production = line.slice('Content-Security-Policy:'.length).trim();
  for (const directive of ["worker-src 'none'", "trusted-types 'none'"]) {
    if (!production.includes(directive)) throw new Error(`The policy no longer says ${directive}.`);
  }
  return production
    .replace("worker-src 'none'", "worker-src 'self'")
    .replace("trusted-types 'none'", 'trusted-types default');
}

test('a session under the console policy causes no violation', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Trusted Types are enforced in Chromium only.');

  await page.addInitScript((mockWorker) => {
    const types = (
      window as unknown as {
        trustedTypes?: {
          createPolicy: (name: string, rules: { createScriptURL: (url: string) => string }) => void;
        };
      }
    ).trustedTypes;
    types?.createPolicy('default', {
      createScriptURL: (url) => {
        if (new URL(url, location.href).pathname === mockWorker) return url;
        throw new TypeError(`Trusted Types: ${url} is not the mock's worker.`);
      },
    });
    const seen: string[] = [];
    Object.assign(window, { __violations: seen });
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  }, MOCK_WORKER);
  // The first document only: from then on the console navigates client-side,
  // and the policy stays with the document.
  await page.route(
    (url) => url.pathname === '/sign-in',
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': policy() },
      });
    },
  );

  await page.goto('/sign-in');
  const demo = page.getByRole('region', { name: 'Demo account' });
  await page.getByLabel('Email').fill((await demo.locator('dd').nth(0).textContent()) ?? '');
  await page.getByLabel('Password').fill((await demo.locator('dd').nth(1).textContent()) ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('200 · 130 results')).toBeVisible();
  await page.getByRole('link', { name: MOCK_ACCOUNTS.admin.email }).click();
  await expect(page.getByRole('region', { name: 'Concurrency' })).toBeVisible();
  await page.getByRole('button', { name: 'Inspector' }).click();
  await expect(page.getByRole('list', { name: 'Requests' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Console' })
    .getByRole('link', { name: 'Session' })
    .click();
  await expect(page.getByText(/^Expires in/)).toBeVisible();

  const violations = await page.evaluate(
    () => (window as unknown as { __violations: string[] }).__violations,
  );
  expect(violations).toEqual([]);
});
