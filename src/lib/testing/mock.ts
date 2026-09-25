import { API_BASE_URL } from '@/lib/api/client';
import { resetDatabase } from '@/lib/testing/db';
import { random } from '@/lib/testing/handlers/ids';
import { resetLimits } from '@/lib/testing/limits';
import { resetScenario } from '@/lib/testing/scenario';

export {
  advanceClock,
  setDatabaseDown,
  setRefreshRace,
  simulateColdStart,
} from '@/lib/testing/scenario';
export type { RefreshRaceOutcome } from '@/lib/testing/scenario';
export { MOCK_ACCOUNTS, SYNTHETIC_PASSWORD } from '@/lib/testing/factories';
export { REFRESH_COOKIE } from '@/lib/testing/handlers/auth';

/**
 * Returns the mock to its starting state: data, clock, limits, scenario, and the
 * refresh cookie. MSW keeps mocked cookies in its own jar, which nothing exposes,
 * so the cookie is cleared the way the contract clears it - by a logout.
 */
export async function resetMock(): Promise<void> {
  resetScenario();
  await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  resetScenario();
  resetLimits();
  resetDatabase();
  random.reset();
}
