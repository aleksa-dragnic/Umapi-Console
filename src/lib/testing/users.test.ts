import { api } from '@/lib/api/client';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { buildUsers, ROLES } from '@/lib/testing/factories';
import { call, json, signIn } from '@/lib/testing/support';
import type { Session } from '@/lib/testing/support';

let demo: Session;
let admin: Session;

beforeEach(async () => {
  demo = await signIn(MOCK_ACCOUNTS.demo);
  admin = await signIn(MOCK_ACCOUNTS.admin);
});

const list = (query: string, session: Session = demo) =>
  call(`/api/v1/users${query}`, { headers: session.auth });

const pagination = (response: Response) =>
  JSON.parse(response.headers.get('X-Pagination') ?? '{}') as Record<string, unknown>;

const emails = async (response: Response) =>
  ((await response.json()) as Array<{ email: string }>).map((user) => user.email);

describe('mock: the user directory (rows 12-21, 43, 47, 56)', () => {
  it('answers a bare array with pagination in a camelCase header, ten per page by default', async () => {
    const response = await list('');
    const body = (await response.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(10);
    expect(Object.keys(body[0] as object).sort()).toEqual([
      'email',
      'firstName',
      'id',
      'lastName',
      'status',
    ]);
    expect(pagination(response)).toEqual({
      currentPage: 1,
      totalPages: 13,
      pageSize: 10,
      totalCount: 130,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it('clamps the page size to 50 rather than refusing it', async () => {
    const response = await list('?pageSize=500');
    expect(response.status).toBe(200);
    expect(pagination(response)['pageSize']).toBe(50);
  });

  it('works through the typed client, which sends the PascalCase names (row 64)', async () => {
    const { data, response } = await api.GET('/api/v1/users', {
      params: { query: { PageSize: 3, OrderBy: 'email desc' } },
      headers: demo.auth,
    });
    expect(response.status).toBe(200);
    expect(data).toHaveLength(3);
  });

  it('sorts by the whitelist, reverses on desc, and ignores an unknown field', async () => {
    const deactivated = '?status=Deactivated&pageSize=50';
    const ascending = await emails(await list(`${deactivated}&orderBy=email asc`));
    const descending = await emails(await list(`${deactivated}&orderBy=email desc`));
    expect(ascending.length).toBeGreaterThan(1);
    expect(descending).toEqual([...ascending].reverse());
    expect(await emails(await list(`${deactivated}&orderBy=nonsense`))).toEqual(ascending);
    const byLastName = (await (
      await list(`${deactivated}&orderBy=lastName desc, email`)
    ).json()) as Array<{ lastName: string }>;
    expect(
      byLastName[0]?.lastName.localeCompare(byLastName.at(-1)?.lastName ?? ''),
    ).toBeGreaterThanOrEqual(0);
  });

  it('filters by status case-insensitively, and refuses an unknown status with 422', async () => {
    const locked = await list('?status=locked&pageSize=50');
    expect(
      ((await locked.json()) as Array<{ status: string }>).every(
        (user) => user.status === 'Locked',
      ),
    ).toBe(true);
    const nonsense = await list('?status=nonsense');
    expect(nonsense.status).toBe(422);
    expect(await nonsense.json()).toMatchObject({
      errorCode: 'Validation.General',
      errors: { Status: ['Status must be one of: Pending, Active, Locked, Deactivated.'] },
    });
  });

  it('searches each field on its own, ignoring case but not diacritics', async () => {
    const search = async (term: string) => {
      const response = await list(`?pageSize=50&searchTerm=${encodeURIComponent(term)}`);
      return {
        total: pagination(response)['totalCount'],
        users: (await response.json()) as Array<{
          email: string;
          firstName: string;
          lastName: string;
        }>,
      };
    };
    expect((await search('ADMIN')).total).toBe((await search('admin')).total);
    expect((await search('reader')).total).toBe(1);
    expect((await search('demo reader')).total).toBe(0);
    expect((await search('zzz')).total).toBe(0);

    // Names keep their diacritics; addresses are ASCII. So `ović` finds people
    // by name, and `ovic` finds them only through the address, never the name.
    const accented = await search('ović');
    expect(accented.total).toBeGreaterThan(0);
    expect(accented.users.every((user) => !user.email.includes('ović'))).toBe(true);
    const plain = await search('ovic');
    expect(plain.users.every((user) => user.email.includes('ovic'))).toBe(true);
    expect((await search('ĆIRIĆ')).total).toBe((await search('ćirić')).total);
  });

  it('answers the detail with the v1 body, and an unknown id with 404', async () => {
    const response = await call(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}`, { headers: demo.auth });
    expect(await response.json()).toMatchObject({
      email: MOCK_ACCOUNTS.demo.email,
      firstName: 'Demo',
      lastName: 'Reader',
      roles: [{ name: 'Member' }],
    });
    const missing = await call('/api/v1/users/00000000-0000-4000-8000-000000000000', {
      headers: demo.auth,
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ errorCode: 'User.NotFound' });
  });
});

describe('mock: caching and writes (rows 22-27, 49, 57, 58)', () => {
  it('serves weak ETags and answers a matching If-None-Match with an empty 304', async () => {
    for (const path of ['/api/v1/users', `/api/v1/users/${MOCK_ACCOUNTS.demo.id}`]) {
      const first = await call(path, { headers: demo.auth });
      const etag = first.headers.get('ETag') ?? '';
      expect(etag).toMatch(/^W\/"/);
      const second = await call(path, { headers: { ...demo.auth, 'If-None-Match': etag } });
      expect(second.status).toBe(304);
      expect(await second.text()).toBe('');
    }
  });

  it('refuses a write from the demo account with 403 before validating the body', async () => {
    const response = await call('/api/v1/users', { method: 'POST', ...json({}, demo.auth) });
    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty('errorCode');
  });

  it('answers an update with an empty 204, moves the ETag, and lets the last write win', async () => {
    const path = `/api/v1/users/${MOCK_ACCOUNTS.demo.id}`;
    const before = (await call(path, { headers: admin.auth })).headers.get('ETag');
    const write = (lastName: string) =>
      call(path, {
        method: 'PUT',
        ...json(
          { email: MOCK_ACCOUNTS.demo.email, firstName: 'Demo', lastName },
          { ...admin.auth, 'If-Match': before ?? '' },
        ),
      });
    const first = await write('First');
    expect(first.status).toBe(204);
    expect(await first.text()).toBe('');
    // A stale If-Match is not read: the second write wins silently.
    expect((await write('Second')).status).toBe(204);
    const after = await call(path, { headers: admin.auth });
    expect(after.headers.get('ETag')).not.toBe(before);
    expect(await after.json()).toMatchObject({ lastName: 'Second' });
  });

  it('answers domain conflicts with 409 and domain refusals with 400, with their error codes', async () => {
    const locked = buildUsers().find((user) => user.status === 'Locked');
    const active = buildUsers().find((user) => user.status === 'Active' && user.roles.length === 1);
    const deactivated = buildUsers().find((user) => user.status === 'Deactivated');
    const post = (path: string, body?: unknown) =>
      call(path, {
        method: 'POST',
        headers: { ...admin.auth, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const expectCode = async (response: Response, status: number, errorCode: string) => {
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ errorCode });
    };

    await expectCode(await post(`/api/v1/users/${locked?.id}/lock`), 409, 'User.AlreadyLocked');
    await expectCode(
      await call(`/api/v1/users/${active?.id}/lock`, { method: 'DELETE', headers: admin.auth }),
      400,
      'User.NotLocked',
    );
    await expectCode(await post(`/api/v1/users/${deactivated?.id}/lock`), 400, 'User.Deactivated');
    await expectCode(
      await call(`/api/v1/users/${active?.id}/roles/${active?.roles[0]?.roleId}`, {
        method: 'DELETE',
        headers: admin.auth,
      }),
      400,
      'User.LastRoleCannotBeRemoved',
    );

    const held = await post(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}/roles`, {
      roleId: ROLES[2]?.id,
    });
    expect(held.status).toBe(409);
    expect(await held.json()).toMatchObject({
      title: 'Conflict',
      detail: 'The user already holds this role.',
      errorCode: 'User.RoleAlreadyAssigned',
      instance: `POST /api/v1/users/${MOCK_ACCOUNTS.demo.id}/roles`,
    });
  });

  it('lets an administrator lock and unlock, and assign and remove a role', async () => {
    const active = buildUsers().find((user) => user.status === 'Active' && user.roles.length === 1);
    const supportId = ROLES[1]?.id ?? '';
    expect(
      (await call(`/api/v1/users/${active?.id}/lock`, { method: 'POST', headers: admin.auth }))
        .status,
    ).toBe(204);
    expect(
      (await call(`/api/v1/users/${active?.id}/lock`, { method: 'DELETE', headers: admin.auth }))
        .status,
    ).toBe(204);
    expect(
      (
        await call(`/api/v1/users/${active?.id}/roles`, {
          method: 'POST',
          ...json({ roleId: supportId }, admin.auth),
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await call(`/api/v1/users/${active?.id}/roles/${supportId}`, {
          method: 'DELETE',
          headers: admin.auth,
        })
      ).status,
    ).toBe(204);
  });

  it('lists roles with their permissions', async () => {
    const response = await call('/api/v1/roles', { headers: demo.auth });
    expect(await response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Member', permissions: ['users.read', 'roles.read'] }),
      ]),
    );
  });

  it('answers a request with no token with 401 in the framework shape', async () => {
    const response = await call('/api/v1/users');
    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty('errorCode');
  });

  it('answers the 101st read by one user in a minute with 429 (row 52)', async () => {
    for (let request = 1; request <= 100; request += 1) {
      expect((await call('/api/v1/roles', { headers: demo.auth })).status).toBe(200);
    }
    const over = await call('/api/v1/roles', { headers: demo.auth });
    expect(over.status).toBe(429);
    expect(over.headers.get('Retry-After')).toBe('60');
    expect((await call('/api/v1/roles', { headers: admin.auth })).status).toBe(200);
  });
});
