import { decodeClaims } from '@/lib/api/claims';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { signIn } from '@/lib/testing/support';

function tokenWith(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const base64 = btoa(String.fromCharCode(...bytes));
  const url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${url}.signature`;
}

describe('decoding the access token (row 4)', () => {
  it('reads the permission claim as the array the demo account carries', async () => {
    const { accessToken } = await signIn(MOCK_ACCOUNTS.demo);

    const claims = decodeClaims(accessToken);

    expect([...(claims?.permissions ?? [])].sort()).toEqual(['roles.read', 'users.read']);
    expect(claims?.all['sub']).toBe(MOCK_ACCOUNTS.demo.id);
    expect(claims?.lifetimeSeconds).toBe(900);
  });

  it('reads a single permission serialised as a string', () => {
    const claims = decodeClaims(tokenWith({ permission: 'users.read', iat: 100, exp: 1000 }));

    expect(claims?.permissions).toEqual(['users.read']);
  });

  it('decodes a latin-ext email as UTF-8', () => {
    const claims = decodeClaims(tokenWith({ email: 'dušan.petrović@example.org' }));

    expect(claims?.all['email']).toBe('dušan.petrović@example.org');
  });

  it('has no lifetime when iat or exp is missing', () => {
    expect(decodeClaims(tokenWith({ exp: 1000 }))?.lifetimeSeconds).toBeNull();
  });

  it.each([
    ['no payload segment', 'not-a-token'],
    ['a payload that is not base64', 'a.%%%.b'],
    ['a payload that is not JSON', `a.${btoa('not json')}.b`],
    ['a payload that is not an object', `a.${btoa('[1,2]')}.b`],
  ])('yields no claims for %s', (_, token) => {
    expect(decodeClaims(token)).toBeNull();
  });
});
