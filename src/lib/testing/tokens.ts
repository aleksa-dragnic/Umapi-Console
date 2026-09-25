import { db, permissionsOf } from '@/lib/testing/db';
import type { MockUser } from '@/lib/testing/factories';
import { now } from '@/lib/testing/scenario';

// Row 2: access tokens live fifteen minutes. Row 3: refresh tokens seven days.
export const ACCESS_TOKEN_SECONDS = 900;
export const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60;

// The console never verifies a signature, so the mock's is a fixed marker that
// only lets the mock tell its own tokens from anything else.
const SIGNATURE = 'bW9jay1zaWduYXR1cmU';

function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function randomToken(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(String.fromCharCode(...values));
}

export interface IssuedAccessToken {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
}

/**
 * Row 4: `aud` and `iss` are `usermanagementapi`, `sub` is the user id, plus
 * `email`, `jti`, `nbf`, `iat`, `exp` and `permission` - an array, or a string
 * when the account holds exactly one. No name claim, no role claim.
 */
export function issueAccessToken(user: MockUser): IssuedAccessToken {
  const issuedAt = Math.floor(now() / 1000);
  const expires = issuedAt + ACCESS_TOKEN_SECONDS;
  const permissions = permissionsOf(user);
  const payload = {
    aud: 'usermanagementapi',
    iss: 'usermanagementapi',
    sub: user.id,
    email: user.email,
    jti: crypto.randomUUID(),
    nbf: issuedAt,
    iat: issuedAt,
    exp: expires,
    permission: permissions.length === 1 ? permissions[0] : permissions,
  };
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  return {
    accessToken: `${header}.${base64url(JSON.stringify(payload))}.${SIGNATURE}`,
    accessTokenExpiresAtUtc: new Date(expires * 1000).toISOString(),
  };
}

export function issueRefreshToken(userId: string): string {
  const value = randomToken(48);
  db().refreshTokens.set(value, {
    value,
    userId,
    expiresAtMs: now() + REFRESH_TOKEN_SECONDS * 1000,
    state: 'active',
  });
  return value;
}

export type BearerCheck =
  | { ok: true; user: MockUser; permissions: string[] }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

/**
 * Row 9: an access token is not checked against revocation, so it keeps working
 * until `exp` - after reuse detection, and after its user is locked (row 51).
 */
export function checkBearer(request: Request): BearerCheck {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing' };
  }
  const parts = header.slice('Bearer '.length).split('.');
  if (parts.length !== 3 || parts[2] !== SIGNATURE) {
    return { ok: false, reason: 'invalid' };
  }
  let claims: { sub?: unknown; exp?: unknown; permission?: unknown };
  try {
    claims = JSON.parse(fromBase64url(parts[1] ?? '')) as typeof claims;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  if (claims.exp * 1000 <= now()) {
    return { ok: false, reason: 'expired' };
  }
  const user = db().users.get(claims.sub);
  if (!user) {
    return { ok: false, reason: 'invalid' };
  }
  const permission = claims.permission;
  const permissions =
    typeof permission === 'string'
      ? [permission]
      : Array.isArray(permission)
        ? permission.filter((p): p is string => typeof p === 'string')
        : [];
  return { ok: true, user, permissions };
}
