import { defineConfig } from '@playwright/test';

// Web Vitals budgets (#63): Lighthouse measures the production build with the
// mock, the bundle e2e serves (ADR 0012), on the screens a visitor meets
// first. Chromium only, because Lighthouse drives Chrome through its debugging
// port, and one worker, because a measurement shares the machine with nothing.
//
// The server is the e2e one, built and served the same way
// (playwright.config.ts explains the flags).
export const DEBUGGING_PORT = 9223;
const PORT = 5273;
const OUT_DIR = 'dist-e2e';
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e/lighthouse',
  outputDir: 'test-results/lighthouse',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Three Lighthouse runs, each with mobile throttling.
  timeout: 180_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: { args: [`--remote-debugging-port=${DEBUGGING_PORT}`] },
  },
  webServer: {
    command: `pnpm exec vite build --mode e2e --outDir ${OUT_DIR} && pnpm exec vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
