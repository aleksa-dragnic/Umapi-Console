import { setupWorker } from 'msw/browser';
import { handlers } from '@/lib/testing/handlers';

/**
 * The mock for the dev server. `main.tsx` starts it before the first render
 * unless `VITE_API_MODE` is `live`; a production build never imports this file.
 */
export async function startMockWorker(): Promise<void> {
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass' });
}
