import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { AppRoutes } from '@/app/AppRoutes';
import '@/styles/theme.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing from index.html');
}
const root = createRoot(container);

function render(): void {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </StrictMode>,
  );
}

// The mock answers the dev server, and the `e2e` build Playwright runs against
// (ADR 0012). Both conditions are literals the build replaces, so a production
// build removes the branch and contains neither the mock nor MSW - build plan
// Gate 2, asserted in CI by searching dist/. Only the `e2e` build exposes the
// mock's controls to a spec; the dev server does not.
const E2E = import.meta.env.MODE === 'e2e';
const startMock =
  (import.meta.env.DEV || E2E) && import.meta.env.VITE_API_MODE !== 'live'
    ? () =>
        import('@/lib/testing/browser').then((mock) =>
          mock.startMockWorker({ exposeControls: E2E }),
        )
    : null;

if (startMock) {
  startMock().then(render, (error: unknown) => {
    console.error('The mock failed to start; requests will reach the network.', error);
    render();
  });
} else {
  render();
}
