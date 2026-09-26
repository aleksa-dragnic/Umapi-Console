import { gateReason } from '@/lib/api/permissions';

describe('the reason a gated control states (inventory section 2.6)', () => {
  it('names the permission required and every permission held', () => {
    expect(gateReason('users.write', ['users.read', 'roles.read'])).toBe(
      'Requires users.write. This account holds users.read, roles.read.',
    );
  });

  it('lists them in the order of row 48, whatever order the token carries them in', () => {
    expect(gateReason('users.lock', ['roles.read', 'users.read'])).toBe(
      'Requires users.lock. This account holds users.read, roles.read.',
    );
  });

  it('says so when the account holds none', () => {
    expect(gateReason('roles.manage', [])).toBe(
      'Requires roles.manage. This account holds no permissions.',
    );
  });
});
