import { setupWorker } from 'msw/browser';
import { handlers } from '@/lib/testing/handlers';
import { restoreRefreshTokens, saveRefreshTokens } from '@/lib/testing/persistence';
import { setRefreshRace } from '@/lib/testing/scenario';

/**
 * The mock in a browser: the dev server, and the `e2e` build Playwright runs
 * against (ADR 0012). `main.tsx` starts it before the first render unless
 * `VITE_API_MODE` is `live`; a production build never imports this file.
 *
 * The refresh tokens are read back before the worker starts and written after
 * every mocked response, so a reload keeps the session the cookie names
 * (`persistence.ts`).
 *
 * With `exposeControls`, which `main.tsx` sets in the `e2e` mode only, the
 * scenario controls a spec needs are placed on `window.__umapiMock` before the
 * first render, and a spec reaches them with `page.evaluate` (ADR 0012). The
 * scenario lives in the page, and a reload restores its defaults, so a spec
 * sets it after the page has loaded. CI searches the production bundle for the
 * name, which exists only in this file.
 */
export interface MockControls {
  setRefreshRace: typeof setRefreshRace;
}

export async function startMockWorker({ exposeControls = false } = {}): Promise<void> {
  restoreRefreshTokens();
  const worker = setupWorker(...handlers);
  worker.events.on('response:mocked', () => saveRefreshTokens());
  await worker.start({ onUnhandledRequest: 'bypass' });
  if (exposeControls) {
    const controls: MockControls = { setRefreshRace };
    Object.assign(window, { __umapiMock: controls });
  }
}
