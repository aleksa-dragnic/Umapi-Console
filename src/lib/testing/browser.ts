import { setupWorker } from 'msw/browser';
import { handlers } from '@/lib/testing/handlers';
import { restoreRefreshTokens, saveRefreshTokens } from '@/lib/testing/persistence';

/**
 * The mock in a browser: the dev server, and the `e2e` build Playwright runs
 * against (ADR 0012). `main.tsx` starts it before the first render unless
 * `VITE_API_MODE` is `live`; a production build never imports this file.
 *
 * The refresh tokens are read back before the worker starts and written after
 * every mocked response, so a reload keeps the session the cookie names
 * (`persistence.ts`).
 */
export async function startMockWorker(): Promise<void> {
  restoreRefreshTokens();
  const worker = setupWorker(...handlers);
  worker.events.on('response:mocked', () => saveRefreshTokens());
  await worker.start({ onUnhandledRequest: 'bypass' });
}
