import { defineConfig } from '@playwright/test';

// The specs run against a production-mode bundle served by vite preview, not
// the dev server: minified, compiled and routed as it is deployed. It is built
// in the `e2e` mode, which is the production build plus the mock, because
// every route now asks the API for a session first and a required check must
// not depend on a free instance being awake. The production build itself is
// proven mock-free by CI. See docs/adr/0012-e2e-runs-a-production-build-with-the-mock.md.
//
// Two details that cost an evening and are therefore written down:
//
//   - vite is invoked through `pnpm exec`, never `pnpm run preview -- <flags>`.
//     When the command runs through a shell rather than an interactive prompt,
//     pnpm forwards the `--` verbatim; vite's parser reads it as the end of
//     options and silently discards every flag that follows.
//
//   - the port is not vite's default 4173, which is commonly already bound by
//     an editor's port forwarding. Combined with a discarded --strictPort, the
//     server quietly relocates to the next free port while Playwright waits on
//     the one it was told about, and the only symptom is a timeout.
//
// `workers` is deliberately absent: exactOptionalPropertyTypes rejects an
// explicit undefined on an optional property.

const PORT = 5273;
const OUT_DIR = 'dist-e2e';
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec vite build --mode e2e --outDir ${OUT_DIR} && pnpm exec vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
