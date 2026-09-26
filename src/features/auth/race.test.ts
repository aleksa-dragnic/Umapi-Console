import { classifyRace, decisiveAnswer, raceRefreshes, type RacePair } from '@/features/auth/race';
import { currentAccessToken, setAccessToken } from '@/lib/api/access-token';
import { onRefresh, sessionEndOf, type AuthResult } from '@/lib/api/refresh';
import { setRefreshRace } from '@/lib/testing/mock';
import { call, json, signIn } from '@/lib/testing/support';

const stops: Array<() => void> = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));

function heard(): AuthResult[] {
  const results: AuthResult[] = [];
  stops.push(onRefresh((result) => results.push(result)));
  return results;
}

async function signedIn(): Promise<string> {
  const { accessToken } = await signIn();
  setAccessToken(accessToken);
  return accessToken;
}

const token: AuthResult = { kind: 'token', accessToken: 'winner' };
const reused: AuthResult = {
  kind: 'refused',
  problem: { status: 401, title: 'Unauthorized', errorCode: 'Auth.RefreshTokenReused' },
  retryAfterSeconds: 60,
};
const conflict: AuthResult = {
  kind: 'refused',
  problem: { status: 409, title: 'Conflict', errorCode: 'Concurrency.Conflict' },
  retryAfterSeconds: 60,
};

describe('the reuse demonstration (inventory section 3.9, rows 11 and 46)', () => {
  it('on a 409, keeps the session running on the token of the winner, and adopts it once', async () => {
    const before = await signedIn();
    const results = heard();

    const outcome = await raceRefreshes();

    expect(outcome.kind).toBe('raced');
    expect(currentAccessToken()).not.toBeNull();
    expect(currentAccessToken()).not.toBe(before);
    expect(results.map((result) => result.kind)).toEqual(['token']);
  });

  it('on a reused token, clears the token at once and ends the session once, with the reuse reason', async () => {
    await signedIn();
    setRefreshRace('reuse');
    const results = heard();

    const outcome = await raceRefreshes();

    expect(outcome.kind).toBe('revoked');
    expect(currentAccessToken()).toBeNull();
    expect(results.map(sessionEndOf)).toEqual(['reused']);
  });

  it('states any other pair as it arrived and leaves the session alone', async () => {
    const before = await signedIn();
    // Sign-in spent one of the ten a minute the refresh shares (row 52).
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call('/api/v1/auth/login', {
        method: 'POST',
        ...json({ email: 'nobody@example.org', password: 'x' }),
      });
    }
    const results = heard();

    const outcome = await raceRefreshes();

    expect(outcome.kind).toBe('unexpected');
    expect(
      outcome.pair.map((result) => result.kind === 'refused' && result.problem.status),
    ).toEqual([429, 429]);
    expect(currentAccessToken()).toBe(before);
    expect(results).toEqual([]);
  });

  it.each([
    ['the reuse arrives second', [token, reused]],
    ['the reuse arrives first', [reused, token]],
  ] as const)('lets a reuse 401 decide over a new token whichever comes first: %s', (_, pair) => {
    expect(decisiveAnswer(pair as RacePair)).toBe(reused);
  });

  it.each([
    ['one 200 and one 409', [token, conflict], 'raced'],
    ['one 409 and one 200', [conflict, token], 'raced'],
    ['one 200 and one reuse 401', [token, reused], 'revoked'],
    ['two 200s', [token, token], 'unexpected'],
    ['two 409s', [conflict, conflict], 'unexpected'],
  ] as const)('classifies %s', (_, pair, kind) => {
    expect(classifyRace(pair as RacePair).kind).toBe(kind);
  });
});
