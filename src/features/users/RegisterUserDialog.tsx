import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { outcomeOf, type Outcome } from '@/features/users/changes';
import { UNREACHABLE_COPY } from '@/features/users/Failure';
import {
  bodyOf,
  check,
  keyFor,
  LIMITS,
  useRegisterUser,
  type Registration,
  type RegistrationErrors,
} from '@/features/users/register';
import { fieldErrors } from '@/lib/api/problem';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Input } from '@/ui/Input';
import { RateLimitNotice } from '@/ui/RateLimitNotice';

/**
 * Registering a user (inventory section 3.13, #82). The fields are checked as
 * the API would check them before anything is sent; whatever the API still
 * refuses lands on the same field. Focus goes to the first field with a
 * message. While the request is in flight the dialog holds (section 3.5's
 * `submitting`), and a retry of the same body reuses its Idempotency-Key.
 */

const FIELDS = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'off' },
  { name: 'firstName', label: 'First name', type: 'text', autoComplete: 'off' },
  { name: 'lastName', label: 'Last name', type: 'text', autoComplete: 'off' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
] as const satisfies ReadonlyArray<{
  name: keyof Registration;
  label: string;
  type: string;
  autoComplete: string;
}>;

const EMPTY: Registration = { email: '', firstName: '', lastName: '', password: '' };

export const PASSWORD_HINT = `At least ${LIMITS.passwordMin} characters.`;

/** The API's field message for a field, whatever the casing of its key (row 19). */
function serverMessage(outcome: Outcome | null, field: keyof Registration): string | undefined {
  if (outcome?.kind !== 'invalid') return undefined;
  const messages = fieldErrors(outcome.problem, field);
  return messages.length > 0 ? messages.join(' ') : undefined;
}

/** What a refusal says when it has no field to land on. A 429 is Register's own reason. */
function formMessage(outcome: Outcome | null): string | null {
  if (outcome === null) return null;
  switch (outcome.kind) {
    case 'invalid': {
      const placed = FIELDS.some(({ name }) => serverMessage(outcome, name) !== undefined);
      return placed ? null : (outcome.problem.detail ?? outcome.problem.title);
    }
    case 'refused':
    case 'conflict':
    case 'forbidden':
      return outcome.problem.detail ?? outcome.problem.title;
    case 'rate-limited':
      return null;
    case 'failed':
      if (outcome.failure.kind === 'unreachable') return UNREACHABLE_COPY;
      return `${outcome.failure.problem.status} ${outcome.failure.problem.title}`;
  }
}

export function RegisterUserDialog({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: (id: string) => void;
}) {
  const formId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(EMPTY);
  const [checked, setChecked] = useState<RegistrationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [waited, setWaited] = useState(false);
  const previous = useRef<{ key: string; body: Registration } | null>(null);
  const registration = useRegisterUser();

  const outcome = registration.error === null ? null : outcomeOf(registration.error);
  const limited = outcome?.kind === 'rate-limited' && !waited;

  const messageFor = (field: keyof Registration): string | undefined =>
    checked[field] ?? serverMessage(outcome, field);

  function focusField(name: keyof Registration): void {
    const element = form.current?.elements.namedItem(name);
    if (element instanceof HTMLInputElement) element.focus();
  }

  // After the API refuses, focus goes to the first field it blamed (section 4).
  useEffect(() => {
    if (outcome?.kind !== 'invalid') return;
    const blamed = FIELDS.find(({ name }) => serverMessage(outcome, name) !== undefined);
    if (blamed !== undefined) focusField(blamed.name);
  }, [outcome]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (registration.isPending || limited) return;

    const errors = check(values);
    setChecked(errors);
    const first = FIELDS.find(({ name }) => errors[name] !== undefined);
    if (first !== undefined) {
      focusField(first.name);
      return;
    }

    const body = bodyOf(values);
    const key = keyFor(body, previous.current);
    previous.current = { key, body };
    setWaited(false);
    registration.mutate({ body, key }, { onSuccess: ({ id }) => onRegistered(id) });
  }

  const message = formMessage(outcome);

  return (
    <Dialog
      open
      title="Register a user"
      onClose={onClose}
      action={{
        label: 'Register',
        form: formId,
        onConfirm: () => undefined,
        pending: registration.isPending,
        disabledReason:
          outcome?.kind === 'rate-limited' && limited ? (
            <RateLimitNotice seconds={outcome.seconds} onElapsed={() => setWaited(true)} />
          ) : undefined,
      }}
    >
      <form
        id={formId}
        ref={form}
        aria-label="Register a user"
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-app-3"
      >
        {FIELDS.map(({ name, label, type, autoComplete }) => (
          <Input
            key={name}
            name={name}
            label={label}
            type={name === 'password' && showPassword ? 'text' : type}
            autoComplete={autoComplete}
            value={values[name]}
            error={messageFor(name)}
            hint={name === 'password' ? PASSWORD_HINT : undefined}
            readOnly={registration.isPending}
            onChange={(event) => {
              setValues({ ...values, [name]: event.target.value });
              // A message the field no longer deserves goes as it is corrected.
              if (checked[name] !== undefined) setChecked({ ...checked, [name]: undefined });
            }}
          />
        ))}
        <div>
          <Button aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? 'Hide password' : 'Show password'}
          </Button>
        </div>
        {message === null ? null : (
          <p role="alert" className="text-fg-danger">
            {message}
          </p>
        )}
      </form>
    </Dialog>
  );
}
