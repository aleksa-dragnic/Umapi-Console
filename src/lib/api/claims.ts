/**
 * The access token's claims, read in the browser (build plan section 4.5,
 * ADR 0009). Row 4 measured them: `aud`, `iss`, `sub`, `email`, `jti`, `nbf`,
 * `iat`, `exp`, and `permission` - a JSON array, or a string when the account
 * holds exactly one. No name claim, no role claim.
 *
 * The signature is not verified. The console is not where access is decided:
 * the API checks every request, and the claims only decide what the interface
 * offers. A token that cannot be read yields no claims, which offers nothing.
 */

export interface AccessClaims {
  /** Every claim as the payload carries it, for the session screen's table. */
  readonly all: Readonly<Record<string, unknown>>;
  /** `permission`, always as a list. */
  readonly permissions: readonly string[];
  /** `exp - iat` in seconds, or null when either is missing or they disagree. */
  readonly lifetimeSeconds: number | null;
}

function payloadOf(token: string): unknown {
  const segment = token.split('.')[1];
  if (segment === undefined || segment === '') return null;
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  // The email claim may carry latin-ext letters: decode the bytes as UTF-8.
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function permissionsOf(claim: unknown): string[] {
  if (typeof claim === 'string') return [claim];
  if (Array.isArray(claim)) {
    return claim.filter((permission): permission is string => typeof permission === 'string');
  }
  return [];
}

export function decodeClaims(token: string): AccessClaims | null {
  let payload: unknown;
  try {
    payload = payloadOf(token);
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;

  const all = payload as Record<string, unknown>;
  const { iat, exp } = all;
  const lifetimeSeconds =
    typeof iat === 'number' && typeof exp === 'number' && exp > iat ? exp - iat : null;
  return { all, permissions: permissionsOf(all['permission']), lifetimeSeconds };
}
