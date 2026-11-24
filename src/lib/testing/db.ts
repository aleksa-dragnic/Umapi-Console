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

/**
 * One change to a user, as the API's audit log reports it (its ADR 0025): field
 * names, never values; the actor's id, null for a system write.
 */
export interface MockHistoryEntry {
  occurredAtUtc: string;
  action: 'registered' | 'updated' | 'deleted' | 'roleAssigned' | 'roleRemoved';
  fields: string[];
  roleId: string | null;
  actorId: string | null;
}

/** A registration sent with an Idempotency-Key: the body it was sent with, and the user it made. */
export interface MockRegistration {
  body: string;
  userId: string;
}

interface Database {
  users: Map<string, MockUser>;
  roles: Map<string, MockRole>;
  refreshTokens: Map<string, MockRefreshToken>;
  /** Keyed by the caller's id and the key, as the API scopes them (its ADR 0023). */
  registrations: Map<string, MockRegistration>;
  /** Each user's changes, oldest first. */
  history: Map<string, MockHistoryEntry[]>;
}

/** A seeded user's history: registered by the seeder, with the roles it holds. */
function seeded(user: MockUser): MockHistoryEntry[] {
  return [
    {
      occurredAtUtc: user.createdAtUtc,
      action: 'registered',
      fields: [],
      roleId: null,
      actorId: null,
    },
    ...user.roles.map((assignment) => ({
      occurredAtUtc: assignment.assignedAtUtc,
      action: 'roleAssigned' as const,
      fields: [],
      roleId: assignment.roleId,
      actorId: null,
    })),
  ];
}

function fresh(seed: number): Database {
  const users = buildUsers(seed);
  return {
    users: new Map(users.map((user) => [user.id, user])),
    roles: new Map(ROLES.map((role) => [role.id, { ...role, permissions: [...role.permissions] }])),
    refreshTokens: new Map(),
    registrations: new Map(),
    history: new Map(users.map((user) => [user.id, seeded(user)])),
  };
}

/** Appends a change to a user's history, at the mock's clock. */
export function recordChange(userId: string, change: MockHistoryEntry): void {
  const entries = database.history.get(userId) ?? [];
  entries.push(change);
  database.history.set(userId, entries);
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
