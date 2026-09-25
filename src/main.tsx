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
// Gate 2, asserted in CI by searching dist/.
const startMock =
  (import.meta.env.DEV || import.meta.env.MODE === 'e2e') &&
  import.meta.env.VITE_API_MODE !== 'live'
    ? () => import('@/lib/testing/browser').then((mock) => mock.startMockWorker())
    : null;

if (startMock) {
  startMock().then(render, (error: unknown) => {
    console.error('The mock failed to start; requests will reach the network.', error);
    render();
  });
} else {
  render();
}
