import { MOCK_ACCOUNTS, USER_STATUSES, buildUsers } from '@/lib/testing/factories';

describe('buildUsers', () => {
  const users = buildUsers();

  it('builds about 130 users: the two production accounts and 128 synthetic ones', () => {
    expect(users).toHaveLength(130);
    expect(users.map((user) => user.email)).toEqual(
      expect.arrayContaining([MOCK_ACCOUNTS.admin.email, MOCK_ACCOUNTS.demo.email]),
    );
  });

  it('spreads users across all four statuses', () => {
    const present = new Set(users.map((user) => user.status));
    expect([...present].sort()).toEqual([...USER_STATUSES].sort());
  });

  it('uses latin-ext names, the characters search does not fold', () => {
    const accented = users.filter((user) =>
      /[^\u0020-\u007e]/.test(user.firstName + user.lastName),
    );
    expect(accented.length).toBeGreaterThan(40);
    expect(users.some((user) => user.firstName === 'Marko' && user.lastName === 'Petrović')).toBe(
      true,
    );
  });

  it('gives every user a unique address and at least one role', () => {
    expect(new Set(users.map((user) => user.email)).size).toBe(users.length);
    expect(users.every((user) => user.roles.length > 0)).toBe(true);
  });

  it('is the same on every run for the same seed, and different for another', () => {
    expect(buildUsers()).toEqual(users);
    expect(buildUsers(1)).not.toEqual(users);
  });
});
