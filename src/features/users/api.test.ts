import { fetchDirectory, paginationOf } from '@/features/users/api';
import type { DirectoryQuery } from '@/features/users/url-state';
import { setAccessToken } from '@/lib/api/access-token';
import { signIn } from '@/lib/testing/support';

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
