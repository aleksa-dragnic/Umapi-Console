import { defineConfig } from '@playwright/test';

// Screenshots of the specimen route (#64): every primitive in every state, in
// both densities, compared with committed baselines. The specimen exists in
// development only (ADR 0005), so this runs against the Vite dev server, which
// serves the mock as `pnpm dev` does.
//
// A screenshot depends on the platform's fonts and rendering, so the baselines
// are made in the Playwright image CI uses, never on a workstation:
// scripts/update-specimen-snapshots.sh. Chromium only.
const PORT = 5274;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e/visual',
  outputDir: 'test-results/visual',
  // One baseline per section and density, with no platform suffix: there is
  // exactly one platform the baselines are for.
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: {
      // Anti-aliasing differs by a pixel here and there between runs of the
      // same image; a changed token or primitive moves far more than this.
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
