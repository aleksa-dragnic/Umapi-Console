import { DEFAULT_SEED, ROLES, buildUsers } from '@/lib/testing/factories';
import type { MockRole, MockUser } from '@/lib/testing/factories';

export type RefreshTokenState = 'active' | 'rotating' | 'rotated' | 'revoked';

export interface MockRefreshToken {
  value: string;
  userId: string;
  expiresAtMs: number;
  state: RefreshTokenState;
  /** Settles when a rotation in flight has been written. */
  rotation?: Promise<void>;
}

interface Database {
  users: Map<string, MockUser>;
  roles: Map<string, MockRole>;
  refreshTokens: Map<string, MockRefreshToken>;
}

function fresh(seed: number): Database {
  return {
    users: new Map(buildUsers(seed).map((user) => [user.id, user])),
    roles: new Map(ROLES.map((role) => [role.id, { ...role, permissions: [...role.permissions] }])),
    refreshTokens: new Map(),
  };
}

let database = fresh(DEFAULT_SEED);

export function resetDatabase(seed: number = DEFAULT_SEED): void {
  database = fresh(seed);
}

export function db(): Database {
  return database;
}

export function findUserByEmail(email: string): MockUser | undefined {
  const wanted = email.trim().toLowerCase();
  for (const user of database.users.values()) {
    if (user.email.toLowerCase() === wanted) {
      return user;
    }
  }
  return undefined;
}

export function permissionsOf(user: MockUser): string[] {
  const permissions = new Set<string>();
  for (const assignment of user.roles) {
    database.roles.get(assignment.roleId)?.permissions.forEach((p) => permissions.add(p));
  }
  return [...permissions].sort();
}

/** Row 8: reuse revokes every active token of the account, not one chain. */
export function revokeAllRefreshTokens(userId: string): void {
  for (const token of database.refreshTokens.values()) {
    if (token.userId === userId && (token.state === 'active' || token.state === 'rotating')) {
      token.state = 'revoked';
    }
  }
}
