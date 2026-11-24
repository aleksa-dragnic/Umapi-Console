import '@testing-library/jest-dom/vitest';
import { setAccessToken } from '@/lib/api/access-token';
import { installDialogStandIn } from '@/lib/testing/dialog';
import { resetMock } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';

// jsdom has no showModal(); the stand-in says what it does and does not do.
installDialogStandIn();

// Every test runs against the mock, and a request nothing handles fails the test
// rather than reaching the network (build plan Gate 2).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  setAccessToken(null);
  // A test that takes the browser offline cannot leave the next one offline.
  window.dispatchEvent(new Event('online'));
  await resetMock();
});
afterAll(() => server.close());
