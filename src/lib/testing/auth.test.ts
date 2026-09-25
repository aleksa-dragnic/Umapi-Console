import {
  MOCK_ACCOUNTS,
  SYNTHETIC_PASSWORD,
  advanceClock,
  setRefreshRace,
} from '@/lib/testing/mock';
import { buildUsers } from '@/lib/testing/factories';
import { call, claimsOf, json, refresh, refreshCookieOf, signIn } from '@/lib/testing/support';

const login = (email: string, password: string) =>
  call('/api/v1/auth/login', { method: 'POST', ...json({ email, password }) });

describe('mock: login (rows 1-5, section 3.2)', () => {
  it('answers with the access token and its expiry only, and sets the refresh cookie', async () => {
    const response = await login(MOCK_ACCOUNTS.demo.email, MOCK_ACCOUNTS.demo.password);
    expect(response.status).toBe(200);
    expect(Object.keys((await response.json()) as object).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresAtUtc',
    ]);
    const cookie = response.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/^umapi_rt=[^;]+;/);
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=604800');
    expect(cookie).not.toContain('Domain');
  });

  it('issues a fifteen-minute token with the claims row 4 lists', async () => {
    const { accessToken } = await signIn();
    const claims = claimsOf(accessToken);
    expect(claims).toMatchObject({
      aud: 'usermanagementapi',
      iss: 'usermanagementapi',
      sub: MOCK_ACCOUNTS.demo.id,
      email: MOCK_ACCOUNTS.demo.email,
      permission: ['roles.read', 'users.read'],
    });
    expect((claims['exp'] as number) - (claims['iat'] as number)).toBe(900);
    expect(claims).not.toHaveProperty('role');
  });

  it('answers an unknown email and a wrong password identically apart from traceId', async () => {
    const strip = async (response: Response) => {
      const { traceId, ...rest } = (await response.json()) as Record<string, unknown>;
      expect(traceId).toEqual(expect.any(String));
      return { status: response.status, ...rest };
    };
    const unknown = await strip(await login('nobody@example.org', 'whatever'));
    const wrong = await strip(await login(MOCK_ACCOUNTS.demo.email, 'wrong'));
    expect(unknown).toEqual(wrong);
    expect(unknown).toMatchObject({ status: 401, errorCode: 'Auth.InvalidCredentials' });
  });

  it('answers a missing field with 422 and field errors', async () => {
    const response = await login('', '');
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      errorCode: 'Validation.General',
      errors: { Email: expect.any(Array), Password: expect.any(Array) },
    });
  });

  it('refuses a locked account', async () => {
    const locked = buildUsers().find((user) => user.status === 'Locked');
    const response = await login(locked?.email ?? '', SYNTHETIC_PASSWORD);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ errorCode: 'Auth.AccountLocked' });
  });
});

describe('mock: refresh (rows 6-9, 11, section 3.2)', () => {
  it('is a 401 with no cookie, and a 200 with one (Gate 2)', async () => {
    const without = await refresh();
    expect(without.status).toBe(401);
    expect(await without.json()).toMatchObject({ errorCode: 'Auth.InvalidRefreshToken' });

    await signIn();
    const withCookie = await refresh();
    expect(withCookie.status).toBe(200);
    expect(Object.keys((await withCookie.json()) as object).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresAtUtc',
    ]);
  });

  it('rotates the cookie on every refresh', async () => {
    await signIn();
    const first = refreshCookieOf(await refresh());
    const second = refreshCookieOf(await refresh());
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('treats a superseded token as reuse and revokes every session of the account', async () => {
    const signedIn = await login(MOCK_ACCOUNTS.demo.email, MOCK_ACCOUNTS.demo.password);
    const superseded = refreshCookieOf(signedIn);
    const { accessToken } = (await signedIn.json()) as { accessToken: string };
    const current = refreshCookieOf(await refresh());

    const replay = await refresh(`umapi_rt=${superseded}`);
    expect(replay.status).toBe(401);
    expect(await replay.json()).toMatchObject({ errorCode: 'Auth.RefreshTokenReused' });
    expect(replay.headers.get('Set-Cookie')).toContain('Max-Age=0');

    // Row 8: the current token is revoked too. Row 9: the access token is not.
    const afterwards = await refresh(`umapi_rt=${current}`);
    expect(await afterwards.json()).toMatchObject({ errorCode: 'Auth.InvalidRefreshToken' });
    const read = await call('/api/v1/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(read.status).toBe(200);
  });

  it('ends two concurrent refreshes in a 409 with nothing revoked, by default (row 11)', async () => {
    await signIn();
    const outcomes = await Promise.all([refresh(), refresh()]);
    expect(outcomes.map((response) => response.status).sort()).toEqual([200, 409]);
    const loser = outcomes.find((response) => response.status === 409);
    expect(await loser?.json()).toMatchObject({ errorCode: 'Concurrency.Conflict' });
    expect((await refresh()).status).toBe(200);
  });

  it('ends them in a 401 reuse with everything revoked when told to (row 46)', async () => {
    setRefreshRace('reuse');
    await signIn();
    const outcomes = await Promise.all([refresh(), refresh()]);
    expect(outcomes.map((response) => response.status).sort()).toEqual([200, 401]);
    const loser = outcomes.find((response) => response.status === 401);
    expect(await loser?.json()).toMatchObject({ errorCode: 'Auth.RefreshTokenReused' });
    expect((await refresh()).status).toBe(401);
  });

  it('refuses to refresh a user locked after signing in, whose access token still works (row 51)', async () => {
    const target = buildUsers().find(
      (user) => user.status === 'Active' && user.password === SYNTHETIC_PASSWORD,
    );
    const signedIn = await login(target?.email ?? '', SYNTHETIC_PASSWORD);
    const cookie = refreshCookieOf(signedIn);
    const { accessToken } = (await signedIn.json()) as { accessToken: string };

    const admin = await signIn(MOCK_ACCOUNTS.admin);
    const lock = await call(`/api/v1/users/${target?.id}/lock`, {
      method: 'POST',
      headers: admin.auth,
    });
    expect(lock.status).toBe(204);

    const refused = await refresh(`umapi_rt=${cookie}`);
    expect(refused.status).toBe(401);
    expect(await refused.json()).toMatchObject({ errorCode: 'Auth.AccountLocked' });
    const read = await call('/api/v1/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(read.status).toBe(200);
  });

  it('ends a session at logout: the cookie is cleared and refresh refuses', async () => {
    await signIn();
    const logout = await call('/api/v1/auth/logout', { method: 'POST' });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await refresh()).status).toBe(401);
  });

  it('answers an expired access token with 401 in the framework shape (rows 10, 34)', async () => {
    const session = await signIn();
    advanceClock(901_000);
    const response = await call('/api/v1/users', { headers: session.auth });
    expect(response.status).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: 401, title: 'Unauthorized' });
    expect(body).not.toHaveProperty('errorCode');
    expect(body).not.toHaveProperty('detail');
  });
});

describe('mock: auth limits (rows 28, 29)', () => {
  it('answers the eleventh auth request in a minute with 429 in the rate-limiter shape', async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect((await login('nobody@example.org', 'x')).status).toBe(401);
    }
    const eleventh = await login('nobody@example.org', 'x');
    expect(eleventh.status).toBe(429);
    expect(eleventh.headers.get('Retry-After')).toBe('60');
    const body = (await eleventh.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: 429, title: 'Too Many Requests' });
    expect(body).not.toHaveProperty('errorCode');
    expect(body).not.toHaveProperty('traceId');
  });

  it('answers a body over 256 KB with 413', async () => {
    const response = await call('/api/v1/auth/login', {
      method: 'POST',
      ...json({ email: 'x'.repeat(300 * 1024), password: 'x' }),
    });
    expect(response.status).toBe(413);
  });
});
