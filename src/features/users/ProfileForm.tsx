import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { Outcome } from '@/features/users/changes';
import { UNREACHABLE_COPY } from '@/features/users/Failure';
import { fieldErrors, type Problem } from '@/lib/api/problem';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { RateLimitNotice } from '@/ui/RateLimitNotice';

/**
 * The profile edit, inline in the identity panel (inventory section 3.4). The
 * three fields are all required by the API (row 55), and the API is the
 * validation: the browser's own is off, and a 422 puts each message on its
 * field whatever the casing of its key (row 19). An email another user holds is
 * placed on the email field the same way. Focus starts on the first field, and
 * after a refusal on the first field the API blamed (section 4).
 */

export interface ProfileValues {
  email: string;
  firstName: string;
  lastName: string;
}

const FIELDS = [
  { name: 'email', label: 'Email' },
  { name: 'firstName', label: 'First name' },
  { name: 'lastName', label: 'Last name' },
] as const satisfies ReadonlyArray<{ name: keyof ProfileValues; label: string }>;

function messageFor(problem: Problem | null, field: keyof ProfileValues): string | undefined {
  const messages = problem === null ? [] : fieldErrors(problem, field);
  return messages.length > 0 ? messages.join(' ') : undefined;
}

/** What a refusal says when it has no field to land on. A 429 is Save's own reason. */
function formMessage(outcome: Outcome | null): string | null {
  if (outcome === null) return null;
  switch (outcome.kind) {
    case 'invalid': {
      const placed = FIELDS.some(({ name }) => messageFor(outcome.problem, name) !== undefined);
      if (placed) return null;
      return outcome.problem.detail ?? outcome.problem.title;
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

export function ProfileForm({
  initial,
  outcome,
  onSave,
  onCancel,
}: {
  initial: ProfileValues;
  /** Why the last save was refused, if it was. */
  outcome: Outcome | null;
  onSave: (values: ProfileValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [waited, setWaited] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const problem = outcome?.kind === 'invalid' ? outcome.problem : null;
  const limited = outcome?.kind === 'rate-limited' && !waited;

  useEffect(() => {
    const blamed = FIELDS.find(({ name }) => messageFor(problem, name) !== undefined);
    const element = form.current?.elements.namedItem(blamed?.name ?? 'email');
    if (element instanceof HTMLInputElement) element.focus();
  }, [problem]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (limited) return;
    onSave(values);
  }

  const message = formMessage(outcome);

  return (
    <form
      ref={form}
      aria-label="Edit profile"
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-app-3"
    >
      {FIELDS.map(({ name, label }) => (
        <Input
          key={name}
          name={name}
          label={label}
          value={values[name]}
          error={messageFor(problem, name)}
          autoComplete="off"
          onChange={(event) => setValues({ ...values, [name]: event.target.value })}
        />
      ))}
      {message === null ? null : (
        <p role="alert" className="text-fg-danger">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-app-2">
        <Button
          type="submit"
          disabledReason={
            outcome?.kind === 'rate-limited' && limited ? (
              <RateLimitNotice seconds={outcome.seconds} onElapsed={() => setWaited(true)} />
            ) : undefined
          }
        >
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
