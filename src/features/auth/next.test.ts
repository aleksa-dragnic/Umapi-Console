import { SIGN_IN_PATH, safeDestination, signInPathFor } from '@/features/auth/next';

describe('next (inventory section 5)', () => {
  test.each([
    ['/users/7c41ab', '/users/7c41ab'],
    ['/users?page=2&q=ovic', '/users?page=2&q=ovic'],
    [null, '/users'],
    ['', '/users'],
    ['users', '/users'],
    ['https://evil.example', '/users'],
    ['//evil.example', '/users'],
    ['/\\evil.example', '/users'],
    [SIGN_IN_PATH, '/users'],
    [`${SIGN_IN_PATH}?next=/users`, '/users'],
  ])('%s is honoured as %s', (next, expected) => {
    expect(safeDestination(next)).toBe(expected);
  });

  it('writes next only when it is not the default', () => {
    expect(signInPathFor('/users')).toBe(SIGN_IN_PATH);
    // `/` is the landing page since ADR 0018: a destination like any other.
    expect(signInPathFor('/')).toBe(`${SIGN_IN_PATH}?next=${encodeURIComponent('/')}`);
    expect(signInPathFor('/users/7c41ab?tab=roles')).toBe(
      `${SIGN_IN_PATH}?next=${encodeURIComponent('/users/7c41ab?tab=roles')}`,
    );
  });
});
