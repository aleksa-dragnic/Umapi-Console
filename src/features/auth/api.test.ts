import { describeFailure, requestRefresh, requestSignIn } from '@/features/auth/api';
import { stateAfterRefresh } from '@/features/auth/session';
import { DEMO_ACCOUNT } from '@/lib/api/demo-account';
import type { Problem } from '@/lib/api/problem';

const problem = (status: number, title: string): Problem => ({ status, title });

describe('auth calls against the section 3.2 contract', () => {
  it('reads the access token from a sign-in, and the refresh cookie then restores it', async () => {
    const signedIn = await requestSignIn(DEMO_ACCOUNT);
    expect(signedIn).toEqual({ kind: 'token', accessToken: expect.any(String) });

    const refreshed = await requestRefresh();
    expect(refreshed).toEqual({ kind: 'token', accessToken: expect.any(String) });
  });

  it('reports a refresh with no cookie as a refusal carrying the problem', async () => {
    const result = await requestRefresh();
    expect(result).toMatchObject({
      kind: 'refused',
      problem: { status: 401, errorCode: 'Auth.InvalidRefreshToken' },
    });
  });
});

describe('what a refresh answer means for the session', () => {
  it.each([
    [{ kind: 'token', accessToken: 't' } as const, 'authenticated'],
    [
      { kind: 'refused', problem: problem(401, 'Unauthorized'), retryAfterSeconds: 60 } as const,
      'anonymous',
    ],
    [
      {
        kind: 'refused',
        problem: problem(429, 'Too Many Requests'),
        retryAfterSeconds: 42,
      } as const,
      'rate-limited',
    ],
    [
      {
        kind: 'refused',
        problem: problem(503, 'Service Unavailable'),
        retryAfterSeconds: 60,
      } as const,
      'unavailable',
    ],
    [{ kind: 'unreachable' } as const, 'unavailable'],
  ])('%o is %s', (result, status) => {
    expect(stateAfterRefresh(result).status).toBe(status);
  });
});

describe('describeFailure', () => {
  it('names the status and title, the two fields every problem shape carries (observed row 34)', () => {
    expect(
      describeFailure({
        kind: 'refused',
        problem: problem(503, 'Service Unavailable'),
        retryAfterSeconds: 60,
      }),
    ).toBe('The API answered 503 Service Unavailable.');
  });

  it('says the API could not be reached when nothing answered', () => {
    expect(describeFailure({ kind: 'unreachable' })).toBe('The console cannot reach the API.');
  });
});
