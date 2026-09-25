import { HttpResponse, http } from 'msw';
import type { Schema } from '@/lib/api/client';
import { db, findUserByEmail } from '@/lib/testing/db';
import { USER_STATUSES } from '@/lib/testing/factories';
import type { MockUser, UserStatus } from '@/lib/testing/factories';
import { guard } from '@/lib/testing/handlers/guard';
import {
  CACHE_HEADERS,
  VERSION_HEADERS,
  endpoint,
  matchesIfNoneMatch,
  queryParam,
  readJson,
  stringField,
  weakETag,
} from '@/lib/testing/http';
import { bodyTooLarge } from '@/lib/testing/limits';
import { applicationProblem, validationProblem } from '@/lib/testing/problems';
import { now } from '@/lib/testing/scenario';
import { random } from '@/lib/testing/handlers/ids';

// Row 14: default page size. Row 15: larger sizes are clamped, not refused.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// Row 47: the sort whitelist, case-insensitive.
const SORTABLE: Record<string, (user: MockUser) => string> = {
  email: (user) => user.email.toLowerCase(),
  firstname: (user) => user.firstName.toLowerCase(),
  lastname: (user) => user.lastName.toLowerCase(),
  status: (user) => user.status,
  createdat: (user) => user.createdAtUtc,
};

function toSummary(user: MockUser): Schema<'UserResponse'> {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
  };
}

// Row 21: the v1 detail body.
function toDetails(user: MockUser): Schema<'UserDetailsResponse'> {
  return {
    ...toSummary(user),
    roles: user.roles.map((assignment) => ({
      roleId: assignment.roleId,
      name: db().roles.get(assignment.roleId)?.name ?? 'Unknown',
      assignedAtUtc: assignment.assignedAtUtc,
    })),
    createdAtUtc: user.createdAtUtc,
    updatedAtUtc: user.updatedAtUtc,
  };
}

function positiveInt(raw: string | null, fallback: number): number {
  // Out-of-range values below 1 were not measured; they fall back.
  const value = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

/** Rows 16, 17 and 47: `field direction`, comma-separated; unknown fields ignored. */
function sortUsers(users: MockUser[], orderBy: string | null): MockUser[] {
  const clauses = (orderBy ?? '')
    .split(',')
    .map((clause) => clause.trim().split(/\s+/))
    .flatMap(([field, direction]) => {
      const key = SORTABLE[(field ?? '').toLowerCase()];
      return key ? [{ key, descending: direction?.toLowerCase() === 'desc' }] : [];
    });
  if (clauses.length === 0) {
    clauses.push({ key: SORTABLE['email'] as (user: MockUser) => string, descending: false });
  }
  return [...users].sort((a, b) => {
    for (const { key, descending } of clauses) {
      const order = key(a).localeCompare(key(b));
      if (order !== 0) {
        return descending ? -order : order;
      }
    }
    return a.id.localeCompare(b.id); // Row 47: the id is always the final key.
  });
}

function parseStatus(raw: string): UserStatus | undefined {
  return USER_STATUSES.find((status) => status.toLowerCase() === raw.toLowerCase());
}

function notFound(request: Request) {
  // Row 49: `*.NotFound` is 404. Wording not measured.
  return applicationProblem(request, 404, 'User.NotFound', 'The user was not found.');
}

// Row 49: modifying a deactivated user is 400. Wording not measured.
function deactivated(request: Request) {
  return applicationProblem(request, 400, 'User.Deactivated', 'The user is deactivated.');
}

function touch(user: MockUser): void {
  user.updatedAtUtc = new Date(now()).toISOString();
}

async function conditional(request: Request, body: unknown, extra: Record<string, string> = {}) {
  const json = JSON.stringify(body);
  const etag = await weakETag(json, extra['X-Pagination'] ?? '');
  const headers = { ...CACHE_HEADERS, ...VERSION_HEADERS, ETag: etag, ...extra };
  if (matchesIfNoneMatch(request, etag)) {
    return new HttpResponse(null, { status: 304, headers }); // Rows 23 and 24.
  }
  return new HttpResponse(json, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function findUser(id: unknown): MockUser | undefined {
  return typeof id === 'string' ? db().users.get(id) : undefined;
}

export const userHandlers = [
  http.get(endpoint('/api/v1/users'), async ({ request }) => {
    const access = await guard(request, 'users.read', 'read'); // Row 48.
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const statusRaw = queryParam(url, 'Status');
    let status: UserStatus | undefined;
    if (statusRaw !== null && statusRaw !== '') {
      status = parseStatus(statusRaw); // Row 18: case-insensitive.
      if (!status) {
        // Row 19: the key is PascalCase whatever the query spelled.
        return validationProblem(request, {
          Status: ['Status must be one of: Pending, Active, Locked, Deactivated.'],
        });
      }
    }

    // Rows 43 and 56: substring, case-insensitive, each field on its own, and no
    // diacritic folding - `ovic` does not find Petrović.
    const term = (queryParam(url, 'SearchTerm') ?? '').trim().toLowerCase();
    const matches = [...db().users.values()].filter(
      (user) =>
        (!status || user.status === status) &&
        (term === '' ||
          [user.email, user.firstName, user.lastName].some((field) =>
            field.toLowerCase().includes(term),
          )),
    );

    const pageSize = Math.min(
      positiveInt(queryParam(url, 'PageSize'), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const currentPage = positiveInt(queryParam(url, 'PageNumber'), 1);
    const sorted = sortUsers(matches, queryParam(url, 'OrderBy'));
    const totalCount = sorted.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const page = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Rows 12 and 13: a bare array; pagination in a camelCase JSON header.
    const pagination = JSON.stringify({
      currentPage,
      totalPages,
      pageSize,
      totalCount,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,
    });
    return conditional(request, page.map(toSummary), { 'X-Pagination': pagination });
  }),

  http.get(endpoint('/api/v1/users/{id}'), async ({ request, params }) => {
    const access = await guard(request, 'users.read', 'read');
    if (!access.ok) return access.response;
    const user = findUser(params['id']);
    if (!user) return notFound(request);
    return conditional(request, toDetails(user)); // Rows 21 and 24.
  }),

  http.post(endpoint('/api/v1/users'), async ({ request }) => {
    const access = await guard(request, 'users.write', 'write'); // Row 27: 403 before validation.
    if (!access.ok) return access.response;
    if (await bodyTooLarge(request)) return new HttpResponse(null, { status: 413 });
    const body = await readJson(request);
    const email = stringField(body, 'email')?.trim() ?? '';
    const firstName = stringField(body, 'firstName')?.trim() ?? '';
    const lastName = stringField(body, 'lastName')?.trim() ?? '';
    const password = stringField(body, 'password') ?? '';
    const errors = requiredFields({
      Email: email,
      FirstName: firstName,
      LastName: lastName,
      Password: password,
    });
    if (errors) return validationProblem(request, errors);
    if (findUserByEmail(email)) {
      return applicationProblem(
        request,
        409,
        'User.EmailNotUnique',
        'The email is already in use.',
      ); // Row 49.
    }
    const stamp = new Date(now()).toISOString();
    const memberRoleId = [...db().roles.values()].find((role) => role.name === 'Member')?.id;
    const user: MockUser = {
      id: random.uuid(),
      email,
      firstName,
      lastName,
      // Not measured: what status a registered user starts in.
      status: 'Pending',
      password,
      roles: memberRoleId ? [{ roleId: memberRoleId, assignedAtUtc: stamp }] : [],
      createdAtUtc: stamp,
      updatedAtUtc: stamp,
    };
    db().users.set(user.id, user);
    return HttpResponse.json({ id: user.id } satisfies Schema<'UserCreatedResponse'>, {
      status: 201,
      headers: { Location: `/api/v1/users/${user.id}` },
    });
  }),

  http.put(endpoint('/api/v1/users/{id}'), async ({ request, params }) => {
    const access = await guard(request, 'users.write', 'write');
    if (!access.ok) return access.response;
    if (await bodyTooLarge(request)) return new HttpResponse(null, { status: 413 });
    const user = findUser(params['id']);
    if (!user) return notFound(request);
    // Row 55: all three fields required.
    const body = await readJson(request);
    const email = stringField(body, 'email')?.trim() ?? '';
    const firstName = stringField(body, 'firstName')?.trim() ?? '';
    const lastName = stringField(body, 'lastName')?.trim() ?? '';
    const errors = requiredFields({ Email: email, FirstName: firstName, LastName: lastName });
    if (errors) return validationProblem(request, errors);
    if (user.status === 'Deactivated') return deactivated(request);
    const owner = findUserByEmail(email);
    if (owner && owner.id !== user.id) {
      return applicationProblem(
        request,
        409,
        'User.EmailNotUnique',
        'The email is already in use.',
      );
    }
    // Rows 26 and 45: no concurrency token and no `If-Match`: last write wins.
    user.email = email;
    user.firstName = firstName;
    user.lastName = lastName;
    touch(user);
    return new HttpResponse(null, { status: 204 }); // Row 57.
  }),

  http.post(endpoint('/api/v1/users/{id}/lock'), async ({ request, params }) => {
    const access = await guard(request, 'users.lock', 'write');
    if (!access.ok) return access.response;
    const user = findUser(params['id']);
    if (!user) return notFound(request);
    if (user.status === 'Deactivated') return deactivated(request);
    if (user.status === 'Locked') {
      return applicationProblem(request, 409, 'User.AlreadyLocked', 'The user is already locked.'); // Row 49.
    }
    // Row 50: nothing refuses locking yourself, or the only administrator.
    // Row 51: locking revokes no session.
    user.status = 'Locked';
    touch(user);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(endpoint('/api/v1/users/{id}/lock'), async ({ request, params }) => {
    const access = await guard(request, 'users.lock', 'write');
    if (!access.ok) return access.response;
    const user = findUser(params['id']);
    if (!user) return notFound(request);
    if (user.status === 'Deactivated') return deactivated(request);
    if (user.status !== 'Locked') {
      return applicationProblem(request, 400, 'User.NotLocked', 'The user is not locked.'); // Row 49.
    }
    user.status = 'Active';
    touch(user);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(endpoint('/api/v1/users/{id}/roles'), async ({ request, params }) => {
    const access = await guard(request, 'roles.manage', 'write');
    if (!access.ok) return access.response;
    const user = findUser(params['id']);
    if (!user) return notFound(request);
    const roleId = stringField(await readJson(request), 'roleId') ?? '';
    if (roleId === '')
      return validationProblem(request, { RoleId: ["'Role Id' must not be empty."] });
    if (!db().roles.has(roleId)) {
      return applicationProblem(request, 404, 'Role.NotFound', 'The role was not found.');
    }
    if (user.status === 'Deactivated') return deactivated(request);
    if (user.roles.some((assignment) => assignment.roleId === roleId)) {
      // Row 58, measured word for word.
      return applicationProblem(
        request,
        409,
        'User.RoleAlreadyAssigned',
        'The user already holds this role.',
      );
    }
    user.roles.push({ roleId, assignedAtUtc: new Date(now()).toISOString() });
    touch(user);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(endpoint('/api/v1/users/{id}/roles/{roleId}'), async ({ request, params }) => {
    const access = await guard(request, 'roles.manage', 'write');
    if (!access.ok) return access.response;
    const user = findUser(params['id']);
    if (!user) return notFound(request);
    if (user.status === 'Deactivated') return deactivated(request);
    const roleId = params['roleId'];
    if (!user.roles.some((assignment) => assignment.roleId === roleId)) {
      return applicationProblem(
        request,
        400,
        'User.RoleNotAssigned',
        'The user does not hold this role.',
      ); // Row 49.
    }
    if (user.roles.length === 1) {
      // Row 50: a user keeps at least one role.
      return applicationProblem(
        request,
        400,
        'User.LastRoleCannotBeRemoved',
        'A user must keep at least one role.',
      );
    }
    user.roles = user.roles.filter((assignment) => assignment.roleId !== roleId);
    touch(user);
    return new HttpResponse(null, { status: 204 });
  }),
];

// Row 19's wording pattern for a missing value. Individual messages not measured.
function requiredFields(fields: Record<string, string>): Record<string, string[]> | undefined {
  const errors: Record<string, string[]> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (value === '') {
      errors[name] = [`'${name.replace(/([a-z])([A-Z])/g, '$1 $2')}' must not be empty.`];
    }
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}
