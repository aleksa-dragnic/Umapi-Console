import { authApi } from '@/lib/api/auth-client';
import type { Schema } from '@/lib/api/create-client';
import type { Problem } from '@/lib/api/problem';
import { settle, type AuthFailure, type AuthResult } from '@/lib/api/refresh';

/**
 * The auth calls the screens make, reduced to what they decide on. The refresh
 * itself lives in `lib/api/refresh.ts`, because the client's middleware needs
 * it too; its result type is re-exported here for the screens.
 */
export { requestRefresh } from '@/lib/api/refresh';
export type { AuthFailure, AuthResult };

/** `POST /auth/login`. On success the API also sets the refresh cookie. */
export function requestSignIn(credentials: Schema<'LoginRequest'>): Promise<AuthResult> {
  return settle(() => authApi.POST('/api/v1/auth/login', { body: credentials }));
}

/**
 * `POST /auth/logout`, with the cookie as the credential: the API revokes the
 * token it is given and clears the cookie (observed row 70, section 3.2). The
 * answer changes nothing the console does - the session in memory is cleared
 * either way - so it is not returned.
 */
export async function requestSignOut(): Promise<void> {
  try {
    await authApi.POST('/api/v1/auth/logout');
  } catch {
    // Unreachable. The session is cleared in memory regardless.
  }
}

/**
 * One line for a failure no screen state names more precisely: the `status`
 * and `title` every problem shape carries (row 34), or the absence of any
 * answer. Sign-in and boot use it without the inventory's pointer to the
 * inspector, which is behind the login (section 3.8).
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
