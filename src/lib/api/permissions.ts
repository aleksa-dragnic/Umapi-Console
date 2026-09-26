import { useAccessToken } from '@/lib/api/access-token';
import { decodeClaims } from '@/lib/api/claims';

/**
 * What the access token permits, read from its `permission` claim and from
 * nothing else (build plan sections 4.5 and 6.4, ADR 0009). Not from a role
 * name, and not from HATEOAS links: the API sends write links to the demo
 * account (observed row 33).
 *
 * It lives in `lib/` because every feature asks, and a feature may not import
 * another (ADR 0003).
 */

/** Row 48: the five permissions, and what each one allows, in the order they are listed. */
export const PERMISSIONS = [
  'users.read',
  'users.write',
  'users.lock',
  'roles.read',
  'roles.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

function rank(permission: string): number {
  const index = (PERMISSIONS as readonly string[]).indexOf(permission);
  return index === -1 ? PERMISSIONS.length : index;
}

/**
 * Inventory section 2.6: the reason a gated control states. The permissions
 * held are listed in row 48's order, not the token's: the claim's order is the
 * API's choice, and the sentence should not change with it.
 */
export function gateReason(required: Permission, held: readonly string[]): string {
  const listed = [...held].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const holds =
    listed.length === 0
      ? 'This account holds no permissions.'
      : `This account holds ${listed.join(', ')}.`;
  return `Requires ${required}. ${holds}`;
}

export type Permit = { allowed: true } | { allowed: false; reason: string };

/**
 * Whether the token held permits `permission`, and if not, why - ready for a
 * control's `disabledReason`. With no token nothing is permitted.
 */
export function useCan(permission: Permission): Permit {
  const token = useAccessToken();
  const held = token === null ? [] : (decodeClaims(token.value)?.permissions ?? []);
  return held.includes(permission)
    ? { allowed: true }
    : { allowed: false, reason: gateReason(permission, held) };
}
