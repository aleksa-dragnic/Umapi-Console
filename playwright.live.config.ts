import { defineConfig } from '@playwright/test';

// The live suite: Playwright against the deployed pair - the console on
// Cloudflare Pages driving the API on Render - run on demand with
// `pnpm test:live` and never in CI, because it depends on a free instance
// waking and a flaky required check trains you to ignore red (build plan
// section 9, Gate 6 row 5).
//
// There is no web server. The console is the deployed one: the API's CORS
// allows only that origin, and the refresh cookie travels only within one
// site (build plan section 3.3), so a bundle served locally could not sign in.
//
// The specs share one demo account and one IP with every visitor:
//
//   - one worker, in order, no retries. Login, refresh and logout share 10
//     requests a minute per IP (observed row 52); the suite makes nine. Do not
//     run it twice inside a minute.
//   - no saved storage state. Every refresh rotates the cookie, so a second
//     context holding the saved one would present a superseded token, and
//     reuse revokes every session of the account (rows 7-8) - every visitor's.
//   - no trace or video: a trace would write the refresh cookie and the bearer
//     token to disk. A screenshot on failure shows only the screen.
//
// The first navigation of each spec may meet a cold start of up to a minute
// (rows 35-37), so tests have 90 seconds.
export default defineConfig({
  testDir: './e2e/live',
  outputDir: 'test-results/live',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'https://console.aleksadragnic.com',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
});
