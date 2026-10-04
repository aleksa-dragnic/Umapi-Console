import { HttpResponse, delay, http } from 'msw';
import { db, findUserByEmail, revokeAllRefreshTokens } from '@/lib/testing/db';
import { endpoint, readJson, stringField } from '@/lib/testing/http';
import { RETRY_AFTER_SECONDS, bodyTooLarge, coldStart, overLimit } from '@/lib/testing/limits';
import { applicationProblem, rateLimitProblem, validationProblem } from '@/lib/testing/problems';
import { now, refreshRace } from '@/lib/testing/scenario';
import { REFRESH_TOKEN_SECONDS, issueAccessToken, issueRefreshToken } from '@/lib/testing/tokens';
import type { MockUser } from '@/lib/testing/factories';

/**
 * The auth contract of build plan section 3.2, which the API adopted in #50
 * (rows 65 and 66): the refresh token travels only in the `umapi_rt` cookie,
 * and the login and refresh bodies carry the access token and its expiry,
 * nothing else. Status codes, error codes, rotation and reuse are rows 1-11;
 * which refusals clear the cookie is row 70.
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

const INVALID_REFRESH_TOKEN = [
  'Auth.InvalidRefreshToken',
  'The refresh token is not valid.',
] as const;

// Rows 51 and 71: the two refusals of a user who proved who they are.
const ACCOUNT_LOCKED = ['Auth.AccountLocked', 'The account is locked.'] as const;
const ACCOUNT_DEACTIVATED = [
  'Auth.AccountDeactivated',
  'The account has been deactivated.',
] as const;

type Refusal = readonly [errorCode: string, detail: string];

function refusal(request: Request, [errorCode, detail]: Refusal) {
  return applicationProblem(request, 401, errorCode, detail);
}

// Row 70: once a cookie was read, every refusal of the refresh clears it.
function refusedRefresh(request: Request, [errorCode, detail]: Refusal) {
  return applicationProblem(request, 401, errorCode, detail, undefined, {
    'Set-Cookie': clearRefreshCookie(),
  });
}

function loginRefusal(user: MockUser): Refusal | undefined {
  if (user.status === 'Locked') return ACCOUNT_LOCKED;
  if (user.status === 'Deactivated') return ACCOUNT_DEACTIVATED;
  return undefined;
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
    const refused = loginRefusal(user);
    if (refused) {
      return refusal(request, refused); // Rows 51 and 71.
    }
    return tokenResponse(user); // Rows 1-4 and 65.
  }),

  http.post(endpoint('/api/v1/auth/refresh'), async ({ request, cookies }) => {
    await coldStart();
    if (overLimit('auth', 'client')) {
      return rateLimitProblem(request, RETRY_AFTER_SECONDS); // Row 52: refresh shares login's limit.
    }
    const value = cookies[REFRESH_COOKIE];
    if (!value) {
      // Row 70: no cookie is row 8's answer, and there is nothing to clear.
      return refusal(request, INVALID_REFRESH_TOKEN);
    }
    const token = db().refreshTokens.get(value);
    if (!token || token.state === 'revoked' || token.expiresAtMs <= now()) {
      return refusedRefresh(request, INVALID_REFRESH_TOKEN); // Rows 8 and 70.
    }

    if (token.state === 'rotating') {
      if (refreshRace() === 'conflict') {
        // Rows 11 and 46: the loser collided with the winner's write. Nothing
        // is revoked, and row 70: a 409 never clears the cookie.
        return applicationProblem(
          request,
          409,
          'Concurrency.Conflict',
          'The record was modified by another request. Read it again and retry.',
        );
      }
      // Row 46's other outcome: the loser reads the row after the winner wrote
      // it, and that is a replay.
      await token.rotation;
    }

    if (token.state === 'rotated') {
      // Rows 7, 8 and 66: every session of the account is revoked, and the
      // cookie is cleared.
      revokeAllRefreshTokens(token.userId);
      return refusedRefresh(request, [
        'Auth.RefreshTokenReused',
        'The refresh token was already exchanged. Every session for this account has been revoked.',
      ]);
    }
    if (token.state !== 'active') {
      return refusedRefresh(request, INVALID_REFRESH_TOKEN);
    }

    const user = db().users.get(token.userId);
    if (!user) {
      return refusedRefresh(request, INVALID_REFRESH_TOKEN);
    }
    const refused = loginRefusal(user);
    if (refused) {
      return refusedRefresh(request, refused); // Rows 51, 70 and 71.
    }

    // Row 6: rotation. The old token is superseded, a new one is issued.
    token.state = 'rotating';
    let written: () => void = () => undefined;
    token.rotation = new Promise<void>((resolve) => (written = resolve));
    await delay(ROTATION_WRITE_MS);
    if (token.state !== 'rotating') {
      // Revoked while in flight by a reuse detected elsewhere.
      written();
      return refusedRefresh(request, INVALID_REFRESH_TOKEN);
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
    // Row 70: 204, and the cookie is cleared, with or without one.
    return new HttpResponse(null, { status: 204, headers: { 'Set-Cookie': clearRefreshCookie() } });
  }),
];
