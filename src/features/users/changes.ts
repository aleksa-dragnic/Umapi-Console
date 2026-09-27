import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  DIRECTORY_KEY,
  detailKey,
  failureOf,
  refused,
  send,
  type RequestFailure,
  type UserDetails,
  type UserRead,
} from '@/features/users/api';
import { api } from '@/lib/api/client';
import type { Permission } from '@/lib/api/permissions';
import type { Problem } from '@/lib/api/problem';

/**
 * The five writes the detail screen makes (build plan section 6.3), and what
 * becomes of each. Every one answers 204 with no body (row 57), so success
 * carries neither the saved record nor its new `ETag`: the detail is read
 * again, and the write counts as settled only when that read returns, so the
 * concurrency panel never shows a tag from before the save. The directory's
 * pages are marked stale in the same step (row 25: its tag moves too).
 *
 * The change is shown at once and rolled back if the API refuses it
 * (inventory section 3.4, `saving`).
 */

export type Change =
  | { kind: 'update'; email: string; firstName: string; lastName: string }
  | { kind: 'lock' }
  | { kind: 'unlock' }
  | { kind: 'assign-role'; roleId: string; name: string }
  | { kind: 'remove-role'; roleId: string };

/** The four controls of the screen, each gated by its own permission (row 48). */
export type Action = 'edit' | 'lock' | 'assign-role' | 'remove-role';

export const PERMISSION_FOR: Record<Action, Permission> = {
  edit: 'users.write',
  lock: 'users.lock',
  'assign-role': 'roles.manage',
  'remove-role': 'roles.manage',
};

/**
 * An assignment the API has not confirmed yet has no time of its own: the
 * client's clock is not the server's (build plan section 4.5), so the row says
 * it is pending instead of inventing one.
 */
export const UNCONFIRMED = '';

export function applied(user: UserDetails, change: Change): UserDetails {
  switch (change.kind) {
    case 'update':
      return {
        ...user,
        email: change.email,
        firstName: change.firstName,
        lastName: change.lastName,
      };
    case 'lock':
      return { ...user, status: 'Locked' };
    case 'unlock':
      return { ...user, status: 'Active' };
    case 'assign-role':
      return {
        ...user,
        roles: [
          ...user.roles,
          { roleId: change.roleId, name: change.name, assignedAtUtc: UNCONFIRMED },
        ],
      };
    case 'remove-role':
      return { ...user, roles: user.roles.filter((role) => role.roleId !== change.roleId) };
  }
}

async function request(id: string, change: Change) {
  const path = { params: { path: { id } } };
  switch (change.kind) {
    case 'update': {
      const { email, firstName, lastName } = change;
      return api.PUT('/api/v1/users/{id}', { ...path, body: { email, firstName, lastName } });
    }
    case 'lock':
      return api.POST('/api/v1/users/{id}/lock', path);
    case 'unlock':
      return api.DELETE('/api/v1/users/{id}/lock', path);
    case 'assign-role':
      return api.POST('/api/v1/users/{id}/roles', { ...path, body: { roleId: change.roleId } });
    case 'remove-role':
      return api.DELETE('/api/v1/users/{id}/roles/{roleId}', {
        params: { path: { id, roleId: change.roleId } },
      });
  }
}

export async function sendChange(id: string, change: Change): Promise<void> {
  const { error, response } = await send(() => request(id, change));
  if (!response.ok) throw refused(response, error);
}

/** What a refused or unanswered write means for the screen (inventory section 3.4). */
export type Outcome =
  /** 422, or an email another user holds: the message belongs on a field. */
  | { kind: 'invalid'; problem: Problem }
  /** 409 with a domain code: the record is not what this tab thinks it is. */
  | { kind: 'conflict'; problem: Problem }
  /** 400 with a domain code: a rule of the API, stated as it was returned. */
  | { kind: 'refused'; problem: Problem }
  /** 403: the interface offered what the token does not permit (section 2.5). */
  | { kind: 'forbidden'; problem: Problem }
  | { kind: 'rate-limited'; problem: Problem; seconds: number }
  /** Anything else, including no answer at all. */
  | { kind: 'failed'; failure: RequestFailure };

export function outcomeOf(error: unknown): Outcome {
  const failure = failureOf(error);
  if (failure.kind === 'unreachable') return { kind: 'failed', failure };
  const { problem } = failure;
  if (problem.status === 422) return { kind: 'invalid', problem };
  if (problem.status === 409 && problem.errorCode === 'User.EmailNotUnique') {
    // Row 49: a 409, but the record did not change - the address belongs to
    // someone else. Reloading would not help, so the API's detail goes on the
    // email field, where the user can act on it.
    return {
      kind: 'invalid',
      problem: { ...problem, errors: { Email: [problem.detail ?? problem.title] } },
    };
  }
  if (problem.status === 409) return { kind: 'conflict', problem };
  if (problem.status === 400) return { kind: 'refused', problem };
  if (problem.status === 403) return { kind: 'forbidden', problem };
  if (problem.status === 429) {
    return { kind: 'rate-limited', problem, seconds: failure.retryAfterSeconds };
  }
  return { kind: 'failed', failure };
}

export function useChangeUser(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: Change) => sendChange(id, change),
    onMutate: async (change: Change) => {
      await client.cancelQueries({ queryKey: detailKey(id) });
      const before = client.getQueryData<UserRead>(detailKey(id));
      if (before !== undefined) {
        client.setQueryData<UserRead>(detailKey(id), {
          ...before,
          user: applied(before.user, change),
        });
      }
      return { before };
    },
    onError: (_error, _change, context) => {
      if (context?.before !== undefined) client.setQueryData(detailKey(id), context.before);
    },
    onSuccess: async () => {
      void client.invalidateQueries({ queryKey: DIRECTORY_KEY });
      await client.invalidateQueries({ queryKey: detailKey(id) });
    },
  });
}
