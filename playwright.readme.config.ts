import { defineConfig } from '@playwright/test';

// The README's screenshots and the landing page's, made rather than taken by
// hand (`pnpm docs:screenshots`): the production build with the mock, as the
// e2e specs run it, so the data is the mock's seed and every run draws the same
// screens. Chromium, 1440 x 900 at twice the density, reduced motion so nothing
// is caught mid-fade. Not a test of anything; run it after a visible change and
// commit the images it writes to docs/images.
const PORT = 5276;
const OUT_DIR = 'dist-readme';
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e/readme',
  outputDir: 'test-results/readme',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `pnpm exec vite build --mode e2e --outDir ${OUT_DIR} && pnpm exec vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
