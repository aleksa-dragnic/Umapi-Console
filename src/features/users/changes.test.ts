import { RequestError, type UserDetails } from '@/features/users/api';
import { UNCONFIRMED, applied, outcomeOf, type Outcome } from '@/features/users/changes';
import type { Problem } from '@/lib/api/problem';

// What each refusal means for the screen (inventory section 3.4), by status and
// by error code (row 49), and what the screen shows before the API answers.

const refusal = (problem: Problem, retryAfterSeconds = 60) =>
  new RequestError({ kind: 'refused', problem, retryAfterSeconds });

describe('what a refused write means', () => {
  it.each<[string, Problem, Outcome['kind']]>([
    [
      'a 422',
      { status: 422, title: 'Unprocessable Entity', errorCode: 'Validation.General' },
      'invalid',
    ],
    [
      'User.AlreadyLocked',
      { status: 409, title: 'Conflict', errorCode: 'User.AlreadyLocked' },
      'conflict',
    ],
    [
      'User.RoleAlreadyAssigned',
      { status: 409, title: 'Conflict', errorCode: 'User.RoleAlreadyAssigned' },
      'conflict',
    ],
    [
      'User.AlreadyDeactivated',
      { status: 409, title: 'Conflict', errorCode: 'User.AlreadyDeactivated' },
      'conflict',
    ],
    [
      'User.NotLocked',
      { status: 400, title: 'Bad Request', errorCode: 'User.NotLocked' },
      'refused',
    ],
    [
      'User.LastRoleCannotBeRemoved',
      { status: 400, title: 'Bad Request', errorCode: 'User.LastRoleCannotBeRemoved' },
      'refused',
    ],
    ['a 403 in the framework shape', { status: 403, title: 'Forbidden' }, 'forbidden'],
    ['a 429', { status: 429, title: 'Too Many Requests' }, 'rate-limited'],
    ['a 404', { status: 404, title: 'Not Found', errorCode: 'User.NotFound' }, 'failed'],
    ['a 503', { status: 503, title: 'Service Unavailable' }, 'failed'],
  ])('%s', (_, problem, kind) => {
    expect(outcomeOf(refusal(problem)).kind).toBe(kind);
  });

  it('puts an email another user holds on the email field, in the API words (row 49)', () => {
    const outcome = outcomeOf(
      refusal({
        status: 409,
        title: 'Conflict',
        errorCode: 'User.EmailNotUnique',
        detail: 'The email is already in use.',
      }),
    );

    expect(outcome).toMatchObject({
      kind: 'invalid',
      problem: { errors: { Email: ['The email is already in use.'] } },
    });
  });

  it('keeps the wait a 429 asked for', () => {
    expect(outcomeOf(refusal({ status: 429, title: 'Too Many Requests' }, 30))).toMatchObject({
      kind: 'rate-limited',
      seconds: 30,
    });
  });

  it('treats no answer, or anything thrown that is not a refusal, as a failure with no answer', () => {
    expect(outcomeOf(new RequestError({ kind: 'unreachable' }))).toEqual({
      kind: 'failed',
      failure: { kind: 'unreachable' },
    });
    expect(outcomeOf(new TypeError('Failed to fetch'))).toEqual({
      kind: 'failed',
      failure: { kind: 'unreachable' },
    });
  });
});

describe('what the screen shows before the API answers', () => {
  const user: UserDetails = {
    id: '345d5955-fa12-48ae-b007-98dabc87f86e',
    email: 'demo@umapi.local',
    firstName: 'Demo',
    lastName: 'Reader',
    status: 'Active',
    roles: [{ roleId: 'member', name: 'Member', assignedAtUtc: '2025-03-01T08:00:00Z' }],
    createdAtUtc: '2025-03-01T08:00:00Z',
    updatedAtUtc: '2025-03-01T08:00:00Z',
  };

  it('the edited profile, and not a new update time the server has not given', () => {
    expect(
      applied(user, { kind: 'update', email: 'e@x.org', firstName: 'Ana', lastName: 'Ilić' }),
    ).toEqual({ ...user, email: 'e@x.org', firstName: 'Ana', lastName: 'Ilić' });
  });

  it('the status a lock and an unlock lead to', () => {
    expect(applied(user, { kind: 'lock' }).status).toBe('Locked');
    expect(applied({ ...user, status: 'Locked' }, { kind: 'unlock' }).status).toBe('Active');
  });

  it('a new role with no time of its own, and a removed one gone', () => {
    const assigned = applied(user, { kind: 'assign-role', roleId: 'support', name: 'Support' });
    expect(assigned.roles.at(-1)).toEqual({
      roleId: 'support',
      name: 'Support',
      assignedAtUtc: UNCONFIRMED,
    });
    expect(applied(assigned, { kind: 'remove-role', roleId: 'member' }).roles).toEqual([
      { roleId: 'support', name: 'Support', assignedAtUtc: UNCONFIRMED },
    ]);
  });
});
