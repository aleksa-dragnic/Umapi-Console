import { shellWord, toCurl } from '@/features/inspector/curl';
import { setAccessToken } from '@/lib/api/access-token';
import { authApi } from '@/lib/api/auth-client';
import { clearCaptures, currentCaptures } from '@/lib/api/capture';
import { api } from '@/lib/api/client';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { signIn, url } from '@/lib/testing/support';

beforeEach(() => clearCaptures());

describe('copy as curl (inventory section 3.8)', () => {
  it('never carries the real token: the header reads $TOKEN, for the shell to expand (Gate 5)', async () => {
    const { accessToken } = await signIn();
    setAccessToken(accessToken);
    await api.GET('/api/v1/users', { params: { query: { PageNumber: 2 } } });

    const [capture] = currentCaptures();
    if (capture === undefined) throw new Error('nothing recorded');
    const command = toCurl(capture);

    expect(command).toBe(
      [
        `curl -X GET '${url('/api/v1/users?PageNumber=2')}'`,
        `-H 'authorization: Bearer '"$TOKEN"`,
      ].join(' \\\n  '),
    );
    expect(command).not.toContain(accessToken);
  });

  it('sends a sign-in body with $PASSWORD in place of the password', async () => {
    await authApi.POST('/api/v1/auth/login', {
      body: { email: MOCK_ACCOUNTS.demo.email, password: MOCK_ACCOUNTS.demo.password },
    });

    const [capture] = currentCaptures();
    if (capture === undefined) throw new Error('nothing recorded');
    const command = toCurl(capture);

    expect(command).toContain(`-H 'content-type: application/json'`);
    expect(command).toContain(
      `--data-raw '{"email":"${MOCK_ACCOUNTS.demo.email}","password":"'"$PASSWORD"'"}'`,
    );
    expect(command).not.toContain(MOCK_ACCOUNTS.demo.password);
  });

  it.each([
    ['plain text', `'plain text'`],
    ["it's", `'it'\\''s'`],
    ['', `''`],
    ['$TOKEN', `"$TOKEN"`],
    ['Bearer $TOKEN', `'Bearer '"$TOKEN"`],
    ['$REFRESH_TOKEN', `"$REFRESH_TOKEN"`],
    ['$HOME and `id`', `'$HOME and \`id\`'`],
  ])('quotes %j as one shell word', (value, word) => {
    expect(shellWord(value)).toBe(word);
  });
});
