import { HttpResponse, http } from 'msw';
import { setupWorker } from 'msw/browser';
import { handlers } from '@/lib/testing/handlers';
import { origin } from '@/lib/testing/http';
import { restoreRefreshTokens, saveRefreshTokens } from '@/lib/testing/persistence';
import { setRefreshRace, simulateColdStart } from '@/lib/testing/scenario';

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
  /**
   * The next request for `method` and `path` (an MSW path such as
   * `/api/v1/users/:id`) gets this answer instead of the mock's. For the
   * states a spec cannot otherwise reach: a 5xx, a 429, a body that breaks a
   * screen.
   */
  respondOnce: (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    status: number,
    body?: unknown,
    headers?: Record<string, string>,
  ) => void;
}

/**
 * What a spec sets before the page loads, with `page.addInitScript`, because a
 * reload resets the scenario: a cold start that holds the boot refresh.
 */
interface BootScenario {
  coldStartMs?: number;
}

export async function startMockWorker({ exposeControls = false } = {}): Promise<void> {
  restoreRefreshTokens();
  const worker = setupWorker(...handlers);
  worker.events.on('response:mocked', () => saveRefreshTokens());
  await worker.start({ onUnhandledRequest: 'bypass' });
  if (exposeControls) {
    const boot = (window as { __umapiMockBoot?: BootScenario }).__umapiMockBoot;
    if (boot?.coldStartMs !== undefined) simulateColdStart(boot.coldStartMs);
    const controls: MockControls = {
      setRefreshRace,
      respondOnce: (method, path, status, body, headers = {}) => {
        const route = { GET: http.get, POST: http.post, PUT: http.put, DELETE: http.delete }[
          method
        ];
        worker.use(
          route(
            origin(path),
            () =>
              new HttpResponse(body === undefined ? null : JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/problem+json', ...headers },
              }),
            { once: true },
          ),
        );
      },
    };
    Object.assign(window, { __umapiMock: controls });
  }
}
