import { setupWorker } from 'msw/browser';
import { handlers } from '@/lib/testing/handlers';

/**
 * The mock in a browser: the dev server, and the `e2e` build Playwright runs
 * against (ADR 0012). `main.tsx` starts it before the first render unless
 * `VITE_API_MODE` is `live`; a production build never imports this file.
 */
export async function startMockWorker(): Promise<void> {
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass' });
}
