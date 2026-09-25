import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import {
  describeFailure,
  describeProblem,
  requestSignIn,
  type AuthFailure,
} from '@/features/auth/api';
import { safeDestination } from '@/features/auth/next';
import { useSession } from '@/features/auth/session';
import { DEMO_ACCOUNT } from '@/lib/api/demo-account';
import { fieldErrors, type Problem } from '@/lib/api/problem';
import type { SessionEnd } from '@/lib/api/refresh';
import { AppMark } from '@/ui/AppMark';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ColdStartNotice } from '@/ui/ColdStartNotice';
import { Input } from '@/ui/Input';
import { RateLimitNotice } from '@/ui/RateLimitNotice';

/**
 * The `sign-in` screen (inventory section 3.2). Editorial density, and the only
 * screen that uses display type. Every state below is a row of that table; the
 * copy is the inventory's.
 *
 * The form does not validate in the browser: the API's 422 is the validation,
 * and its field messages are shown under the field they name.
 */

const FIELDS = ['email', 'password'] as const;
type Field = (typeof FIELDS)[number];

export const INVALID_CREDENTIALS_COPY = 'Email or password is incorrect.';
export const ACCOUNT_LOCKED_COPY = 'This account is locked. An administrator can unlock it.';

/** Inventory section 2.4: the banner, chosen by why the session ended. */
export const SESSION_ENDED_COPY: Record<SessionEnd, string> = {
  ended: 'Your session ended. Sign in again.',
  reused:
    'This session was ended because a refresh token was used twice. Every session of this account has been revoked.',
};

type Phase =
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'invalid-field'; problem: Problem }
  | { kind: 'invalid-credentials' }
  | { kind: 'account-locked' }
  | { kind: 'rate-limited'; seconds: number; attempt: number }
  | { kind: 'failed'; failure: AuthFailure };

function phaseAfterRefusal(failure: AuthFailure, attempt: number): Phase {
  if (failure.kind === 'refused') {
    const { problem } = failure;
    if (problem.status === 422) return { kind: 'invalid-field', problem };
    if (problem.status === 429) {
      return { kind: 'rate-limited', seconds: failure.retryAfterSeconds, attempt };
    }
    if (problem.status === 401) {
      // Chosen by errorCode, never by the detail text. Row 5: an unknown email
      // and a wrong password are the same answer, and the console keeps it so.
      return problem.errorCode === 'Auth.AccountLocked'
        ? { kind: 'account-locked' }
        : { kind: 'invalid-credentials' };
    }
  }
  return { kind: 'failed', failure };
}

/** Field messages the API sent for keys the form has no field for. */
function unplacedMessages(problem: Problem): string[] {
  return Object.entries(problem.errors ?? {})
    .filter(([key]) => !FIELDS.some((field) => field === key.toLowerCase()))
    .flatMap(([, messages]) => messages);
}

export function SignInScreen() {
  const { state, signIn } = useSession();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const form = useRef<HTMLFormElement>(null);
  const attempts = useRef(0);
  const demoHeadingId = useId();

  if (state.status === 'authenticated') {
    return <Navigate to={safeDestination(params.get('next'))} replace />;
  }

  const reason = state.status === 'anonymous' ? state.reason : undefined;
  const ended = reason === 'signed-out' ? undefined : reason;
  const submitting = phase.kind === 'submitting';
  const problem = phase.kind === 'invalid-field' ? phase.problem : null;
  const errorFor = (field: Field): string | undefined => {
    const messages = problem === null ? [] : fieldErrors(problem, field);
    return messages.length > 0 ? messages.join(' ') : undefined;
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || phase.kind === 'rate-limited') return;

    setPhase({ kind: 'submitting' });
    const result = await requestSignIn({ email, password });
    if (result.kind === 'token') {
      signIn(result.accessToken);
      return;
    }

    attempts.current += 1;
    const next = phaseAfterRefusal(result, attempts.current);
    setPhase(next);
    if (next.kind === 'invalid-field') {
      // Inventory section 4: a validation failure moves focus to the first
      // invalid field.
      const first = FIELDS.find((field) => fieldErrors(next.problem, field).length > 0);
      const element = first === undefined ? null : form.current?.elements.namedItem(first);
      if (element instanceof HTMLInputElement) element.focus();
    }
  }

  let message: ReactNode = null;
  if (phase.kind === 'invalid-credentials') message = INVALID_CREDENTIALS_COPY;
  if (phase.kind === 'account-locked') message = ACCOUNT_LOCKED_COPY;
  if (phase.kind === 'invalid-field') {
    const unplaced = unplacedMessages(phase.problem);
    if (unplaced.length > 0) message = unplaced.join(' ');
    else if (phase.problem.errors === undefined) message = describeProblem(phase.problem);
  }
  if (phase.kind === 'failed') {
    const traceId = phase.failure.kind === 'refused' ? phase.failure.problem.traceId : undefined;
    message = (
      <>
        {describeFailure(phase.failure)}
        {traceId === undefined ? null : (
          <span className="block font-mono text-app-meta text-fg-secondary">{traceId}</span>
        )}
      </>
    );
  }

  return (
    <main
      data-density="editorial"
      className="flex min-h-screen items-center justify-center p-[var(--density-pad)] text-[length:var(--density-body)]"
    >
      <div className="flex w-full max-w-md animate-enter flex-col gap-editorial-1">
        <AppMark />

        <div className="flex flex-col gap-app-2">
          <h1 tabIndex={-1} className="font-display text-display-sm text-fg-emphasis">
            Sign in
          </h1>
          <p className="text-editorial-md text-fg-secondary">
            An admin console for UserManagementAPI that does not hide HTTP.
          </p>
        </div>

        {ended === undefined ? null : (
          <p
            role="status"
            className="rounded-card border border-border-default px-app-3 py-app-2 text-editorial-md text-fg-primary"
          >
            {SESSION_ENDED_COPY[ended]}
          </p>
        )}

        {message === null ? null : (
          <div
            role="alert"
            className="rounded-card border border-border-danger px-app-3 py-app-2 text-editorial-md text-fg-danger"
          >
            {message}
          </div>
        )}

        <Card>
          <form
            ref={form}
            noValidate
            aria-label="Sign in"
            onSubmit={(event) => void submit(event)}
            className="flex flex-col gap-app-3"
          >
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              readOnly={submitting}
              onChange={(event) => setEmail(event.target.value)}
              error={errorFor('email')}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              readOnly={submitting}
              onChange={(event) => setPassword(event.target.value)}
              error={errorFor('password')}
            />
            <Button
              type="submit"
              // Full width in every state. Stretched by the form alone, the
              // button would shrink to its label once a countdown wraps it.
              className="w-full"
              pending={submitting}
              disabledReason={
                phase.kind === 'rate-limited' ? (
                  <RateLimitNotice
                    key={phase.attempt}
                    seconds={phase.seconds}
                    onElapsed={() => setPhase({ kind: 'ready' })}
                  />
                ) : undefined
              }
            >
              Sign in
            </Button>
            <ColdStartNotice pending={submitting} />
          </form>
        </Card>

        <section
          aria-labelledby={demoHeadingId}
          className="flex flex-col gap-app-1 font-mono text-app-meta"
        >
          <h2 id={demoHeadingId} className="text-app-label uppercase text-fg-muted">
            Demo account
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-app-2 gap-y-app-1">
            <dt className="text-fg-muted">email</dt>
            <dd className="text-fg-identifier">{DEMO_ACCOUNT.email}</dd>
            <dt className="text-fg-muted">password</dt>
            <dd className="text-fg-identifier">{DEMO_ACCOUNT.password}</dd>
          </dl>
          <p className="text-fg-secondary">Read-only: it holds users.read and roles.read.</p>
        </section>
      </div>
    </main>
  );
}
