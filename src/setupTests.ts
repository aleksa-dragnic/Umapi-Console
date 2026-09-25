import '@testing-library/jest-dom/vitest';
import { resetMock } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';

// Every test runs against the mock, and a request nothing handles fails the test
// rather than reaching the network (build plan Gate 2).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  server.resetHandlers();
  await resetMock();
});
afterAll(() => server.close());
