import { bodyOf, check, keyFor, register, type Registration } from '@/features/users/register';
import { RequestError } from '@/features/users/api';
import { setAccessToken } from '@/lib/api/access-token';
import { MOCK_ACCOUNTS } from '@/lib/testing/mock';
import { signIn } from '@/lib/testing/support';

const VALID: Registration = {
  email: 'nova@example.com',
  firstName: 'Nova',
  lastName: 'Korisnica',
  password: 'Dobra-Lozinka-1',
};

describe('the checks made before sending (the rules of the API)', () => {
  it('accepts what the API accepts', () => {
    expect(check(VALID)).toEqual({});
  });

  it('refuses what the API refuses, field by field', () => {
    expect(check({ email: '', firstName: ' ', lastName: '', password: '1234567' })).toEqual({
      email: 'Enter an email address.',
      firstName: 'Enter a first name.',
      lastName: 'Enter a last name.',
      password: 'At least 8 characters.',
    });
    expect(check({ ...VALID, email: 'no-at-sign' }).email).toBe(
      'Enter an email address like name@example.com.',
    );
    expect(check({ ...VALID, firstName: 'a'.repeat(101) }).firstName).toBe(
      'At most 100 characters.',
    );
    expect(check({ ...VALID, password: 'p'.repeat(129) }).password).toBe('At most 128 characters.');
  });

  it('sends names and email trimmed, and the password exactly as typed', () => {
    expect(bodyOf({ ...VALID, email: ' nova@example.com ', password: ' spaced ' })).toEqual({
      ...VALID,
      email: 'nova@example.com',
      password: ' spaced ',
    });
  });
});

describe('the Idempotency-Key of an attempt', () => {
  it('is reused for the same body and new for another', () => {
    const first = keyFor(VALID, null);
    expect(keyFor(VALID, { key: first, body: VALID })).toBe(first);
    expect(keyFor({ ...VALID, lastName: 'Other' }, { key: first, body: VALID })).not.toBe(first);
  });
});

describe('register against the mock (ADR 0023 of the API)', () => {
  beforeEach(async () => {
    setAccessToken((await signIn(MOCK_ACCOUNTS.admin)).accessToken);
  });

  it('replays the first registration for a retry with the same key and body', async () => {
    const first = await register(VALID, 'retry-key');
    const again = await register(VALID, 'retry-key');

    expect(first.replayed).toBe(false);
    expect(again).toEqual({ id: first.id, replayed: true });
  });

  it('refuses the same key with another body with 422 Idempotency.KeyReused', async () => {
    await register(VALID, 'reused-key');

    const reused = register({ ...VALID, email: 'other@example.com' }, 'reused-key');

    await expect(reused).rejects.toBeInstanceOf(RequestError);
    await reused.catch((error: RequestError) => {
      expect(error.failure.kind === 'refused' && error.failure.problem.status).toBe(422);
      expect(error.failure.kind === 'refused' && error.failure.problem.errorCode).toBe(
        'Idempotency.KeyReused',
      );
    });
  });
});
