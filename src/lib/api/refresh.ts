import type { Middleware } from 'openapi-fetch';

import { currentAccessToken, setAccessToken } from '@/lib/api/access-token';
import { authApi } from '@/lib/api/auth-contract';
import { retryAfterSeconds, toProblem, type Problem } from '@/lib/api/problem';

/**
 * Refreshing the access token: once per page load at boot, and whenever a
 * request that carried a token is answered 401 (inventory section 2.3). Every
 * refresh the console makes goes through `refreshAccessToken`, so at most one
 * is in flight and everything that needs it waits for that one (ADR 0008). Two
 * refreshes sent together with one cookie are the race of observed rows 11 and
 * 46: the console must never start it by accident.
 *
 * This lives in `lib/api` rather than in the auth feature because the client's
 * middleware needs it, and `lib/` imports nothing above it (ADR 0003). The
 * session provider learns the outcome through `onRefresh`.
 */

/**
 * What an auth call came to.
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

export async function settle(
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

/**
 * `POST /auth/refresh`, sent exactly once, with the cookie as the only
 * credential. Rotates the cookie on success (observed row 6, section 3.2).
 * Nothing in the console calls this directly except the reuse demonstration,
 * whose point is to bypass single-flight; everything else uses
 * `refreshAccessToken`.
 */
export function requestRefresh(): Promise<AuthResult> {
  return settle(() => authApi.POST('/api/v1/auth/refresh'));
}

/** Why a session ended, which decides the banner on sign-in (inventory section 2.4). */
export type SessionEnd = 'ended' | 'reused';

export const REFRESH_TOKEN_REUSED = 'Auth.RefreshTokenReused';

/**
 * Whether a refresh answer ends the session. Only a 401 does, whatever its
 * `errorCode` - `Auth.InvalidRefreshToken`, `Auth.AccountLocked` (row 51) or
 * none. A 429 is a wait (row 52), and anything else says nothing about the
 * session. The wording is chosen by `errorCode`, never by `detail`.
 */
export function sessionEndOf(result: AuthResult): SessionEnd | null {
  if (result.kind !== 'refused' || result.problem.status !== 401) return null;
  return result.problem.errorCode === REFRESH_TOKEN_REUSED ? 'reused' : 'ended';
}

type RefreshListener = (result: AuthResult) => void;

const listeners = new Set<RefreshListener>();

/** Called with every refresh answer. Returns the function that stops it. */
export function onRefresh(listener: RefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let inFlight: Promise<AuthResult> | null = null;

/**
 * The refresh, single-flight: a call while one is in flight gets that one's
 * answer instead of sending a second. The token in memory is replaced on a new
 * token and cleared at once on a 401 - access tokens survive revocation until
 * `exp` (observed row 9), so a session the API has ended must not keep working
 * from memory until the next 401.
 */
export function refreshAccessToken(): Promise<AuthResult> {
  inFlight ??= requestRefresh()
    .then((result) => {
      if (result.kind === 'token') {
        setAccessToken(result.accessToken);
      } else if (sessionEndOf(result) !== null) {
        setAccessToken(null);
      }
      listeners.forEach((listener) => listener(result));
      return result;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function bearerOf(request: Request): string | null {
  const header = request.headers.get('Authorization');
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

/**
 * The refusal a waiting request is answered with when the refresh was refused
 * for a reason other than a 401: rebuilt from the fields the console reads
 * (observed row 34), with the wait of a 429, so the screen that made the
 * request shows its own `rate-limited` or `server-error` in place. No answer at
 * all is passed on as no answer.
 */
function refusal(failure: AuthFailure): Response {
  if (failure.kind === 'unreachable') {
    throw new TypeError('The refresh did not reach the API.');
  }
  const headers = new Headers({ 'Content-Type': 'application/problem+json' });
  if (failure.problem.status === 429) {
    headers.set('Retry-After', String(failure.retryAfterSeconds));
  }
  return new Response(JSON.stringify(failure.problem), {
    status: failure.problem.status,
    headers,
  });
}

// The request as it was before it was sent, so it can be sent again: a body
// can be read once, and fetch reads it.
const replays = new WeakMap<Request, Request>();

/**
 * The application client's middleware. It attaches the token held in memory,
 * and answers a 401 on a request that carried one with one refresh and one
 * replay:
 *
 * - the token has already been replaced (a refresh finished while this request
 *   was out): replay with the new one, no refresh;
 * - the token is still the one sent: refresh, joining any refresh in flight;
 * - no token is held any more: the session has ended; the 401 stands.
 *
 * The replay goes straight to fetch, not back through this middleware, so a
 * second 401 is returned as it is rather than refreshed again.
 */
export const silentRefresh: Middleware = {
  onRequest({ request }) {
    const token = currentAccessToken();
    if (token !== null && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    replays.set(request, request.clone());
    return request;
  },

  async onResponse({ request, response }) {
    const sent = bearerOf(request);
    const replay = replays.get(request);
    replays.delete(request);
    if (response.status !== 401 || sent === null || replay === undefined) return undefined;

    let token = currentAccessToken();
    if (token === null) return undefined;
    if (token === sent) {
      const result = await refreshAccessToken();
      if (result.kind !== 'token') {
        return sessionEndOf(result) === null ? refusal(result) : undefined;
      }
      token = result.accessToken;
    }
    replay.headers.set('Authorization', `Bearer ${token}`);
    return globalThis.fetch(replay);
  },
};
