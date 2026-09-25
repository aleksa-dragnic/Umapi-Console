import { setDatabaseDown, simulateColdStart } from '@/lib/testing/mock';
import { call } from '@/lib/testing/support';

describe('mock: health and cold start (rows 35-37)', () => {
  it('delays the first request after a simulated idle period, and only that one', async () => {
    simulateColdStart(300);
    const started = performance.now();
    expect((await call('/health/ready')).status).toBe(200);
    expect(performance.now() - started).toBeGreaterThanOrEqual(290);

    const warm = performance.now();
    await call('/health/live');
    expect(performance.now() - warm).toBeLessThan(250);
  });

  it('fails readiness with 503 while the database is down, and keeps liveness at 200', async () => {
    setDatabaseDown(true);
    expect((await call('/health/ready')).status).toBe(503);
    expect((await call('/health/live')).status).toBe(200);
  });
});
