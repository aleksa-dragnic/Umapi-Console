import {
  readQuery,
  toApiQuery,
  toggledSort,
  writeQuery,
  type DirectoryQuery,
} from '@/features/users/url-state';

const read = (search: string) => readQuery(new URLSearchParams(search));
const DEFAULTS: DirectoryQuery = { page: 1, q: '', sort: null, status: null };

describe('the directory in the address bar (inventory section 5)', () => {
  it('reads every parameter', () => {
    expect(read('page=3&q=ovic&sort=lastName:desc&status=locked')).toEqual({
      page: 3,
      q: 'ovic',
      sort: { field: 'lastName', direction: 'desc' },
      status: 'Locked',
    });
  });

  it.each([
    ['page=0', 'page'],
    ['page=-2', 'page'],
    ['page=2.5', 'page'],
    ['page=abc', 'page'],
    ['status=archived', 'status'],
    ['sort=createdAt:desc', 'sort (no column shows it)'],
    ['sort=nonsense:asc', 'sort'],
    ['sort=email', 'sort without a direction'],
    ['sort=email:up', 'sort with an unknown direction'],
  ])('falls back to the default for an invalid %s (%s)', (search) => {
    expect(read(search)).toEqual(DEFAULTS);
  });

  it('matches status and sort field names whatever their case (row 18)', () => {
    expect(read('status=LOCKED&sort=LASTNAME:asc')).toMatchObject({
      status: 'Locked',
      sort: { field: 'lastName', direction: 'asc' },
    });
  });

  it('keeps the term exactly as typed (row 56)', () => {
    expect(read('q=%20Marko%20Petrovi%C4%87').q).toBe(' Marko Petrović');
  });

  it('writes nothing for a default, and the rest in their URL form', () => {
    expect(writeQuery(DEFAULTS).toString()).toBe('');
    expect(writeQuery({ ...DEFAULTS, sort: { field: 'email', direction: 'asc' } }).toString()).toBe(
      '',
    );
    expect(
      writeQuery({
        page: 2,
        q: 'ovic',
        sort: { field: 'status', direction: 'desc' },
        status: 'Deactivated',
      }).toString(),
    ).toBe('page=2&q=ovic&sort=status%3Adesc&status=deactivated');
  });

  it('sorts a column ascending first, then descending; email ascending is the default', () => {
    expect(toggledSort(DEFAULTS, 'lastName')).toEqual({ field: 'lastName', direction: 'asc' });
    expect(
      toggledSort({ ...DEFAULTS, sort: { field: 'lastName', direction: 'asc' } }, 'lastName'),
    ).toEqual({
      field: 'lastName',
      direction: 'desc',
    });
    expect(toggledSort(DEFAULTS, 'email')).toEqual({ field: 'email', direction: 'desc' });
    expect(
      toggledSort({ ...DEFAULTS, sort: { field: 'email', direction: 'desc' } }, 'email'),
    ).toBeNull();
  });

  it('maps onto the API: one sort clause with a space, the status in its own case (rows 16, 18, 43)', () => {
    expect(
      toApiQuery({
        page: 4,
        q: 'ovic',
        sort: { field: 'lastName', direction: 'desc' },
        status: 'Locked',
      }),
    ).toEqual({ PageNumber: 4, SearchTerm: 'ovic', OrderBy: 'lastName desc', Status: 'Locked' });
    expect(toApiQuery(DEFAULTS)).toEqual({});
  });
});
