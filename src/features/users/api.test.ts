import { fetchDirectory, fetchRoles, fetchUser, paginationOf } from '@/features/users/api';
import type { DirectoryQuery } from '@/features/users/url-state';
import { setAccessToken } from '@/lib/api/access-token';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { server } from '@/lib/testing/server';
import { call, signIn } from '@/lib/testing/support';

const DEFAULTS: DirectoryQuery = { page: 1, q: '', sort: null, status: null };

beforeEach(async () => {
  setAccessToken((await signIn()).accessToken);
});

describe('the directory request', () => {
  it('reports the page the API answered, from X-Pagination (row 13)', async () => {
    const page = await fetchDirectory({ ...DEFAULTS, page: 2 });

    expect(page.status).toBe(200);
    expect(page.users).toHaveLength(10);
    expect(page.pagination).toMatchObject({
      currentPage: 2,
      pageSize: 10,
      totalCount: 130,
      totalPages: 13,
      hasPrevious: true,
      hasNext: true,
    });
  });

  it('sends the term, the status and the sort the way the API reads them (rows 16, 18, 43)', async () => {
    const page = await fetchDirectory({
      ...DEFAULTS,
      q: 'ovic',
      status: 'Active',
      sort: { field: 'email', direction: 'desc' },
    });

    expect(page.users.length).toBeGreaterThan(0);
    expect(page.users.every((user) => user.status === 'Active')).toBe(true);
    expect(
      page.users.every((user) => /ovic/i.test(`${user.email} ${user.firstName} ${user.lastName}`)),
    ).toBe(true);
    const ascending = await fetchDirectory({ ...DEFAULTS, q: 'ovic', status: 'Active' });
    expect(page.users[0]?.email.localeCompare(ascending.users[0]?.email ?? '')).toBeGreaterThan(0);
  });

  it('describes the page that arrived when the header is missing or unreadable', () => {
    expect(paginationOf(null, [], 3)).toEqual({
      currentPage: 3,
      totalPages: 1,
      pageSize: 0,
      totalCount: 0,
      hasPrevious: true,
      hasNext: false,
    });
    expect(paginationOf('not json', [], 1).totalCount).toBe(0);
  });
});

describe('conditional reads (rows 23, 24, 44; ADR 0013)', () => {
  function validators(): Array<string | null> {
    const seen: Array<string | null> = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'GET') seen.push(request.headers.get('If-None-Match'));
    });
    return seen;
  }

  afterEach(() => server.events.removeAllListeners());

  it('sends no validator on a first read, and the one it kept on the next', async () => {
    const sent = validators();
    const first = await fetchDirectory(DEFAULTS);
    const second = await fetchDirectory(DEFAULTS, undefined, first);

    expect(first).toMatchObject({ status: 200, etag: expect.stringMatching(/^W\//) as string });
    expect(sent).toEqual([null, first.etag]);
    expect(second.status).toBe(304);
    expect(second.etag).toBe(first.etag);
    // The same rows, not a copy: nothing on screen has to render again.
    expect(second.users).toBe(first.users);
    expect(second.pagination).toBe(first.pagination);
  });

  it('answers 200 with a new tag once the page has changed (row 25)', async () => {
    const first = await fetchDirectory({ ...DEFAULTS, q: 'reader' });
    const admin = await signIn(MOCK_ACCOUNTS.admin);
    await call(`/api/v1/users/${MOCK_ACCOUNTS.demo.id}/lock`, {
      method: 'POST',
      headers: admin.auth,
    });

    const second = await fetchDirectory({ ...DEFAULTS, q: 'reader' }, undefined, first);

    expect(second.status).toBe(200);
    expect(second.etag).not.toBe(first.etag);
    expect(second.users[0]?.status).toBe('Locked');
  });

  it('does the same for a detail and for the roles', async () => {
    const user = await fetchUser(MOCK_ACCOUNTS.demo.id);
    const roles = await fetchRoles();

    const userAgain = await fetchUser(MOCK_ACCOUNTS.demo.id, undefined, user);
    const rolesAgain = await fetchRoles(undefined, roles);

    expect(userAgain).toMatchObject({ status: 304, etag: user.etag });
    expect(userAgain.user).toBe(user.user);
    expect(rolesAgain).toMatchObject({ status: 304, etag: roles.etag });
    expect(rolesAgain.roles).toBe(roles.roles);
  });
});
