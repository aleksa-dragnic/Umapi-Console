import { currentAccessToken, setAccessToken } from '@/lib/api/access-token';
import { authApi } from '@/lib/api/auth-contract';
import { api } from '@/lib/api/client';
import { DEMO_ACCOUNT } from '@/lib/api/demo-account';
import type { Problem } from '@/lib/api/problem';
import {
  onRefresh,
  refreshAccessToken,
  sessionEndOf,
  type AuthResult,
  type SessionEnd,
} from '@/lib/api/refresh';
import { MOCK_ACCOUNTS, advanceClock, setRefreshRace } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { call, json, refresh, signIn } from '@/lib/testing/support';

// Row 2: an access token lives fifteen minutes.
const expireAccessToken = () => advanceClock(901_000);

async function signedIn(account = MOCK_ACCOUNTS.demo): Promise<string> {
  const { accessToken } = await signIn(account);
  setAccessToken(accessToken);
  return accessToken;
}

function countRefreshes(): { count: number } {
  const seen = { count: 0 };
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === '/api/v1/auth/refresh') seen.count += 1;
  });
  return seen;
}

const stopListening: Array<() => void> = [];

function sessionEnds(): Array<SessionEnd | null> {
  const ends: Array<SessionEnd | null> = [];
  stopListening.push(onRefresh((result) => ends.push(sessionEndOf(result))));
  return ends;
}

afterEach(() => {
  server.events.removeAllListeners();
  stopListening.splice(0).forEach((stop) => stop());
});

describe('silent refresh (inventory section 2.3, ADR 0008)', () => {
  it('meets ten parallel 401s with exactly one refresh, and replays all ten (Gate 3)', async () => {
    const expired = await signedIn();
    expireAccessToken();
    const refreshes = countRefreshes();

    const answers = await Promise.all(Array.from({ length: 10 }, () => api.GET('/api/v1/roles')));

    expect(answers.map(({ response }) => response.status)).toEqual(Array(10).fill(200));
    expect(refreshes.count).toBe(1);
    expect(currentAccessToken()).not.toBe(expired);
  });

  it('replays a 401 for a token that has already been replaced, without refreshing again', async () => {
    const expired = await signedIn();
    expireAccessToken();
    const refreshes = countRefreshes();
    await api.GET('/api/v1/roles');

    const late = await api.GET('/api/v1/roles', {
      headers: { Authorization: `Bearer ${expired}` },
    });

    expect(late.response.status).toBe(200);
    expect(refreshes.count).toBe(1);
  });

  it('returns a replay refused again as it is, instead of refreshing a second time', async () => {
    await signedIn();
    expireAccessToken();
    const refreshes = countRefreshes();
    // The new token is expired before the replay uses it.
    stopListening.push(onRefresh(expireAccessToken));

    const { response } = await api.GET('/api/v1/roles');

    expect(response.status).toBe(401);
    expect(refreshes.count).toBe(1);
  });

  it('does not refresh for a request that carried no token', async () => {
    await signIn();
    const refreshes = countRefreshes();

    const { response } = await api.GET('/api/v1/roles');

    expect(response.status).toBe(401);
    expect(refreshes.count).toBe(0);
  });

  it('answers the waiting request with a 429 on refresh and keeps the session until the wait is over (Gate 3, row 52)', async () => {
    const expired = await signedIn();
    expireAccessToken();
    // Refresh shares the auth budget of ten a minute; the refresh is the eleventh.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call('/api/v1/auth/login', {
        method: 'POST',
        ...json({ email: 'nobody@example.org', password: 'x' }),
      });
    }

    const limited = await api.GET('/api/v1/roles');
    expect(limited.response.status).toBe(429);
    expect(limited.response.headers.get('Retry-After')).toBe('60');
    expect(currentAccessToken()).toBe(expired);

    advanceClock(60_000);
    const later = await api.GET('/api/v1/roles');
    expect(later.response.status).toBe(200);
  });

  it('clears the token at once when the API reports a refresh token used twice (rows 8, 9, 46)', async () => {
    const ends = sessionEnds();
    await signedIn();
    setRefreshRace('reuse');

    // Another tab refreshes with the same cookie a moment earlier.
    const elsewhere = refresh();
    const result = await refreshAccessToken();
    await elsewhere;

    expect(result).toMatchObject({
      kind: 'refused',
      problem: { status: 401, errorCode: 'Auth.RefreshTokenReused' },
    });
    expect(currentAccessToken()).toBeNull();
    expect(ends).toEqual(['reused']);
  });

  it('ends the session when the cookie was revoked elsewhere, and the 401 stands (row 8)', async () => {
    const ends = sessionEnds();
    await signedIn();
    await call('/api/v1/auth/logout', { method: 'POST' });
    expireAccessToken();

    const { response } = await api.GET('/api/v1/roles');

    expect(response.status).toBe(401);
    expect(currentAccessToken()).toBeNull();
    expect(ends).toEqual(['ended']);
  });

  it('ends the session when the account was locked since sign-in (row 51)', async () => {
    const admin = await signIn(MOCK_ACCOUNTS.admin);
    const ends = sessionEnds();
    await signedIn();
    const lock = await call(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}/lock`, {
      method: 'POST',
      headers: admin.auth,
    });
    expect(lock.status).toBe(204);
    expireAccessToken();

    const { response } = await api.GET('/api/v1/roles');

    expect(response.status).toBe(401);
    expect(currentAccessToken()).toBeNull();
    expect(ends).toEqual(['ended']);
  });

  it('never refreshes on the 401 of an auth call itself', async () => {
    await signedIn();
    const refreshes = countRefreshes();

    const { response } = await authApi.POST('/api/v1/auth/login', {
      body: { email: DEMO_ACCOUNT.email, password: 'wrong-password' },
    });

    expect(response.status).toBe(401);
    expect(refreshes.count).toBe(0);
  });

  it('shares one refresh between the boot and a 401 that arrives while it is in flight', async () => {
    await signedIn();
    expireAccessToken();
    const refreshes = countRefreshes();

    const [boot, read] = await Promise.all([refreshAccessToken(), api.GET('/api/v1/roles')]);

    expect(boot.kind).toBe('token');
    expect(read.response.status).toBe(200);
    expect(refreshes.count).toBe(1);
  });
});

describe('which refresh answers end the session (inventory section 2.4)', () => {
  const refused = (status: number, title: string, errorCode?: string): AuthResult => {
    const problem: Problem = { status, title };
    if (errorCode !== undefined) problem.errorCode = errorCode;
    return { kind: 'refused', problem, retryAfterSeconds: 60 };
  };

  it.each([
    ['401 with no errorCode', refused(401, 'Unauthorized'), 'ended'],
    ['Auth.InvalidRefreshToken', refused(401, 'Unauthorized', 'Auth.InvalidRefreshToken'), 'ended'],
    ['Auth.RefreshTokenReused', refused(401, 'Unauthorized', 'Auth.RefreshTokenReused'), 'reused'],
    ['429', refused(429, 'Too Many Requests'), null],
  ] as const)('%s', (_, result, end) => {
    expect(sessionEndOf(result)).toBe(end);
  });
});
