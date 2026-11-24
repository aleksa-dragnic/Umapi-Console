import { useMutation, useQueryClient } from '@tanstack/react-query';

import { DIRECTORY_KEY, refused, send } from '@/features/users/api';
import { api } from '@/lib/api/client';

/**
 * Registering a user (inventory section 3.13, #82). Every attempt carries an
 * `Idempotency-Key` (the API's ADR 0023): a retry of the same body after no
 * answer sends the same key, so the API answers with the first registration
 * instead of making a second one, and a changed body gets a key of its own,
 * because the API refuses a key reused with another body.
 */

export interface Registration {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

/** The API's own limits (RegisterUserCommandValidator, Email, PersonName). */
export const LIMITS = {
  email: 256,
  name: 100,
  passwordMin: 8,
  passwordMax: 128,
} as const;

export type RegistrationErrors = Partial<Record<keyof Registration, string>>;

/**
 * The checks the API would make, made before sending, so an obvious mistake
 * costs no round trip. The API still decides: what it refuses lands on the same
 * fields. The email check is a shape, not a validation of the address.
 */
export function check(values: Registration): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const email = values.email.trim();

  if (email === '') errors.email = 'Enter an email address.';
  else if (email.length > LIMITS.email) errors.email = `At most ${LIMITS.email} characters.`;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter an email address like name@example.com.';
  }

  if (values.firstName.trim() === '') errors.firstName = 'Enter a first name.';
  else if (values.firstName.trim().length > LIMITS.name) {
    errors.firstName = `At most ${LIMITS.name} characters.`;
  }

  if (values.lastName.trim() === '') errors.lastName = 'Enter a last name.';
  else if (values.lastName.trim().length > LIMITS.name) {
    errors.lastName = `At most ${LIMITS.name} characters.`;
  }

  if (values.password.length < LIMITS.passwordMin) {
    errors.password = `At least ${LIMITS.passwordMin} characters.`;
  } else if (values.password.length > LIMITS.passwordMax) {
    errors.password = `At most ${LIMITS.passwordMax} characters.`;
  }

  return errors;
}

/** What is sent: the names and the email trimmed, the password exactly as typed. */
export function bodyOf(values: Registration): Registration {
  return {
    email: values.email.trim(),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    password: values.password,
  };
}

/**
 * The key for an attempt: the previous one when the body is the same as the
 * one it was sent with, a new one otherwise.
 */
export function keyFor(
  body: Registration,
  previous: { key: string; body: Registration } | null,
): string {
  if (previous !== null && JSON.stringify(previous.body) === JSON.stringify(body)) {
    return previous.key;
  }
  return crypto.randomUUID();
}

export interface Registered {
  id: string;
  /** The API answered with an earlier attempt's registration. */
  replayed: boolean;
}

export async function register(body: Registration, key: string): Promise<Registered> {
  const { data, error, response } = await send(() =>
    api.POST('/api/v1/users', {
      params: { header: { 'Idempotency-Key': key } },
      body,
    }),
  );
  if (!response.ok || data === undefined) throw refused(response, error);
  return { id: data.id, replayed: response.headers.get('Idempotency-Replayed') === 'true' };
}

export function useRegisterUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: Registration; key: string }) => register(body, key),
    onSuccess: () => client.invalidateQueries({ queryKey: DIRECTORY_KEY }),
  });
}
