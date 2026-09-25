import { HttpResponse, delay, http } from 'msw';
import { db, findUserByEmail, revokeAllRefreshTokens } from '@/lib/testing/db';
import { endpoint, readJson, stringField } from '@/lib/testing/http';
import { RETRY_AFTER_SECONDS, bodyTooLarge, coldStart, overLimit } from '@/lib/testing/limits';
import { applicationProblem, rateLimitProblem, validationProblem } from '@/lib/testing/problems';
import { now, refreshRace } from '@/lib/testing/scenario';
import { REFRESH_TOKEN_SECONDS, issueAccessToken, issueRefreshToken } from '@/lib/testing/tokens';
import type { MockUser } from '@/lib/testing/factories';

/**
 * The auth contract of build plan section 3.2, which the API adopts in M5: the
 * refresh token travels only in the `umapi_rt` cookie, and the login and refresh
 * bodies carry the access token and its expiry, nothing else. Everything else
 * here - status codes, error codes, rotation, reuse - is what the instance does
 * today (rows 1-11).
 */

export const REFRESH_COOKIE = 'umapi_rt';
const COOKIE_ATTRIBUTES = 'Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict';

// How long a rotation takes to write, so two refreshes sent together overlap.
const ROTATION_WRITE_MS = 25;

function setRefreshCookie(value: string): string {
  return `${REFRESH_COOKIE}=${value}; ${COOKIE_ATTRIBUTES}; Max-Age=${REFRESH_TOKEN_SECONDS}`;
}

function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`;
}

function tokenResponse(user: MockUser) {
  const refreshToken = issueRefreshToken(user.id);
  return HttpResponse.json(issueAccessToken(user), {
    status: 200,
    headers: { 'Set-Cookie': setRefreshCookie(refreshToken) },
  });
}

// Row 8, and section 3.2's "no cookie": the same answer, so neither says why.
function invalidRefreshToken(request: Request) {
  return applicationProblem(
    request,
    401,
    'Auth.InvalidRefreshToken',
    'The refresh token is not valid.',
  );
}

// Row 51. Wording not measured.
function accountLocked(request: Request) {
  return applicationProblem(request, 401, 'Auth.AccountLocked', 'The account is locked.');
}

export const authHandlers = [
  http.post(endpoint('/api/v1/auth/login'), async ({ request }) => {
    await coldStart();
    if (overLimit('auth', 'client')) {
      return rateLimitProblem(request, RETRY_AFTER_SECONDS); // Row 28.
    }
    if (await bodyTooLarge(request)) {
      return new HttpResponse(null, { status: 413 }); // Row 29. Body not measured.
    }
    const body = await readJson(request);
    const email = stringField(body, 'email') ?? '';
    const password = stringField(body, 'password') ?? '';
    const errors: Record<string, string[]> = {};
    if (email.trim() === '') errors['Email'] = ["'Email' must not be empty."];
    if (password === '') errors['Password'] = ["'Password' must not be empty."];
    if (Object.keys(errors).length > 0) {
      return validationProblem(request, errors); // Row 49: Validation.* is 422.
    }

    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      // Row 5: an unknown email and a wrong password answer identically.
      return applicationProblem(
        request,
        401,
        'Auth.InvalidCredentials',
        'The email or password is incorrect.',
      );
    }
    if (user.status === 'Locked') {
      return accountLocked(request);
    }
    return tokenResponse(user); // Rows 1-4, and section 3.2.
  }),

  http.post(endpoint('/api/v1/auth/refresh'), async ({ request, cookies }) => {
    await coldStart();
    if (overLimit('auth', 'client')) {
      return rateLimitProblem(request, RETRY_AFTER_SECONDS); // Row 52: refresh shares login's limit.
    }
    const value = cookies[REFRESH_COOKIE];
    const token = value ? db().refreshTokens.get(value) : undefined;
    if (!token || token.state === 'revoked' || token.expiresAtMs <= now()) {
      return invalidRefreshToken(request);
    }

    if (token.state === 'rotating') {
      if (refreshRace() === 'conflict') {
        // Rows 11 and 46: the loser collided with the winner's write. Nothing
        // is revoked. Wording not measured.
        return applicationProblem(
          request,
          409,
          'Concurrency.Conflict',
          'The resource was changed by another request.',
        );
      }
      // Row 46's other outcome: the loser reads the row after the winner wrote
      // it, and that is a replay.
      await token.rotation;
    }

    if (token.state === 'rotated') {
      // Rows 7 and 8: every session of the account is revoked, and section 3.2
      // clears the cookie.
      revokeAllRefreshTokens(token.userId);
      return applicationProblem(
        request,
        401,
        'Auth.RefreshTokenReused',
        'The refresh token was already exchanged. Every session for this account has been revoked.',
        undefined,
        { 'Set-Cookie': clearRefreshCookie() },
      );
    }
    if (token.state !== 'active') {
      return invalidRefreshToken(request);
    }

    const user = db().users.get(token.userId);
    if (!user) {
      return invalidRefreshToken(request);
    }
    if (user.status === 'Locked') {
      return accountLocked(request); // Row 51.
    }

    // Row 6: rotation. The old token is superseded, a new one is issued.
    token.state = 'rotating';
    let written: () => void = () => undefined;
    token.rotation = new Promise<void>((resolve) => (written = resolve));
    await delay(ROTATION_WRITE_MS);
    if (token.state !== 'rotating') {
      // Revoked while in flight by a reuse detected elsewhere.
      written();
      return invalidRefreshToken(request);
    }
    token.state = 'rotated';
    written();
    return tokenResponse(user);
  }),

  http.post(endpoint('/api/v1/auth/logout'), async ({ request, cookies }) => {
    await coldStart();
    if (overLimit('auth', 'client')) {
      return rateLimitProblem(request, RETRY_AFTER_SECONDS); // Row 52.
    }
    const value = cookies[REFRESH_COOKIE];
    const token = value ? db().refreshTokens.get(value) : undefined;
    if (token && token.state === 'active') {
      token.state = 'revoked';
    }
    // Row 54: 204. Section 3.2: logout clears the cookie.
    return new HttpResponse(null, { status: 204, headers: { 'Set-Cookie': clearRefreshCookie() } });
  }),
];
