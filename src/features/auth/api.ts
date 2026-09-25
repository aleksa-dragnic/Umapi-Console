import { authApi, type LoginRequest } from '@/lib/api/auth-contract';
import { retryAfterSeconds, toProblem, type Problem } from '@/lib/api/problem';

/**
 * The two auth calls PR 9 makes, reduced to what the screens decide on.
 *
 * - `token`: the API issued an access token.
 * - `refused`: it answered with a problem. `retryAfterSeconds` is read only
 *   for a 429, where it means something (observed rows 28 and 52).
 * - `unreachable`: no response at all - offline, DNS, or a CORS refusal, which
 *   a browser reports the same way.
 */
export type AuthResult =
  | { kind: 'token'; accessToken: string }
  | { kind: 'refused'; problem: Problem; retryAfterSeconds: number }
  | { kind: 'unreachable' };

export type AuthFailure = Exclude<AuthResult, { kind: 'token' }>;

async function settle(
  call: () => Promise<{ data?: { accessToken: string }; error?: unknown; response: Response }>,
): Promise<AuthResult> {
  let outcome: Awaited<ReturnType<typeof call>>;
  try {
    outcome = await call();
  } catch {
    return { kind: 'unreachable' };
  }
  const { data, error, response } = outcome;
  if (response.ok && data !== undefined && typeof data.accessToken === 'string') {
    return { kind: 'token', accessToken: data.accessToken };
  }
  return {
    kind: 'refused',
    problem: toProblem(response, error),
    retryAfterSeconds: retryAfterSeconds(response),
  };
}

/** `POST /auth/login`. On success the API also sets the refresh cookie. */
export function requestSignIn(credentials: LoginRequest): Promise<AuthResult> {
  return settle(() => authApi.POST('/api/v1/auth/login', { body: credentials }));
}

/**
 * `POST /auth/refresh`, with the cookie as the only credential. Rotates the
 * cookie on success (observed row 6, section 3.2).
 */
export function requestRefresh(): Promise<AuthResult> {
  return settle(() => authApi.POST('/api/v1/auth/refresh'));
}

/**
 * One line for a failure no screen state names more precisely: the `status`
 * and `title` every problem shape carries (row 34), or the absence of any
 * answer. The inventory's server-error copy adds a pointer to the inspector,
 * which arrives in PR 15.
 */
export function describeFailure(failure: AuthFailure): string {
  if (failure.kind === 'unreachable') {
    return 'The console cannot reach the API.';
  }
  return describeProblem(failure.problem);
}

export function describeProblem(problem: Problem): string {
  return `The API answered ${problem.status} ${problem.title}.`;
}
