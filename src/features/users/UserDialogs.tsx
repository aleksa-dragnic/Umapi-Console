import { useEffect, useRef, useState } from 'react';

import { useRoles, type UserDetails } from '@/features/users/api';
import type { Outcome } from '@/features/users/changes';
import { Failure, UNREACHABLE_COPY } from '@/features/users/Failure';
import { fieldErrors } from '@/lib/api/problem';
import { Dialog, type DialogAction } from '@/ui/Dialog';
import { RateLimitNotice } from '@/ui/RateLimitNotice';
import { Select } from '@/ui/Select';

/**
 * The detail screen's dialogs (inventory sections 3.5 and 3.6). Each holds while
 * its request is in flight and shows the answer that belongs to it: a rule the
 * API refused with (`refused`, 400) is stated as it was returned and leaves
 * only Cancel; a failure with no domain meaning is shown with its status and
 * leaves the action to try again. A domain conflict or a 403 is not the
 * dialog's: the screen closes it and shows the answer on the record.
 */

export const lockCopy = (name: string) =>
  `Locking ${name} refuses their next sign-in and ends the session they have within fifteen minutes. Unlocking reverses it.`;
export const unlockCopy = (name: string) => `Unlocking ${name} lets them sign in again.`;
export const removeRoleCopy = (name: string, role: string) =>
  `${name} will no longer hold ${role}. A user keeps at least one role: the API refuses to remove the last.`;
export const NO_ROLES_COPY = 'This user already holds every role.';

export const fullName = (user: UserDetails) => `${user.firstName} ${user.lastName}`;

/** The line a dialog shows for an answer it keeps, or null when there is none. */
function OutcomeLine({ outcome }: { outcome: Outcome | null }) {
  if (outcome === null || outcome.kind === 'rate-limited') return null;
  if (outcome.kind === 'failed') {
    if (outcome.failure.kind === 'unreachable') {
      return (
        <p role="alert" className="text-fg-danger">
          {UNREACHABLE_COPY}
        </p>
      );
    }
    const { status, title, traceId } = outcome.failure.problem;
    return (
      <div role="alert" className="flex flex-col gap-app-1">
        <p className="text-fg-danger">
          <span className="font-mono">{status}</span> {title}
        </p>
        {traceId === undefined ? null : (
          <p className="font-mono text-app-meta text-fg-secondary">{traceId}</p>
        )}
      </div>
    );
  }
  const { problem } = outcome;
  const messages = outcome.kind === 'invalid' ? fieldErrors(problem, 'roleId') : [];
  return (
    <p role="alert" className="text-fg-danger">
      {messages.length > 0 ? messages.join(' ') : (problem.detail ?? problem.title)}
    </p>
  );
}

/**
 * The action a dialog offers after `outcome`: none once the API has stated a
 * rule, held by the countdown after a 429, otherwise the action as given.
 */
function actionAfter(
  outcome: Outcome | null,
  action: DialogAction,
  waited: boolean,
  onWaited: () => void,
): DialogAction | undefined {
  if (outcome?.kind === 'refused') return undefined;
  if (outcome?.kind === 'rate-limited' && !waited) {
    return {
      ...action,
      disabledReason: <RateLimitNotice seconds={outcome.seconds} onElapsed={onWaited} />,
    };
  }
  return action;
}

export function ConfirmDialog({
  title,
  copy,
  label,
  destructive,
  pending,
  outcome,
  onConfirm,
  onClose,
}: {
  title: string;
  copy: string;
  label: string;
  destructive: boolean;
  pending: boolean;
  outcome: Outcome | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [waitedFor, setWaitedFor] = useState<Outcome | null>(null);
  const action = actionAfter(outcome, { label, onConfirm, pending }, waitedFor === outcome, () =>
    setWaitedFor(outcome),
  );
  return (
    <Dialog open title={title} destructive={destructive} onClose={onClose} action={action}>
      <p className="text-fg-secondary">{copy}</p>
      <OutcomeLine outcome={outcome} />
    </Dialog>
  );
}

export function AssignRoleDialog({
  user,
  pending,
  outcome,
  onAssign,
  onClose,
}: {
  user: UserDetails;
  pending: boolean;
  outcome: Outcome | null;
  onAssign: (roleId: string, name: string) => void;
  onClose: () => void;
}) {
  const roles = useRoles(true);
  const [choice, setChoice] = useState<string | null>(null);
  const [waitedFor, setWaitedFor] = useState<Outcome | null>(null);
  const field = useRef<HTMLDivElement>(null);

  const held = new Set(user.roles.map((role) => role.roleId));
  const available = (roles.data ?? []).filter((role) => !held.has(role.id));
  const chosen = available.find((role) => role.id === choice) ?? available[0];

  useEffect(() => {
    // Inventory sections 3.5 and 4: a 422 moves focus to the offending control.
    if (outcome?.kind === 'invalid') field.current?.querySelector('select')?.focus();
  }, [outcome]);

  let body;
  let action: DialogAction | undefined;
  if (roles.isPending) {
    // `loading-roles`: the skeleton has the field's height, so nothing moves
    // when the list arrives.
    body = (
      <div className="flex flex-col gap-app-1">
        <span role="status" className="sr-only">
          Loading roles
        </span>
        <span aria-hidden="true" className="block h-3 w-16 rounded-control bg-lift" />
        <span
          aria-hidden="true"
          className="block h-[var(--size-control)] rounded-control bg-lift"
        />
      </div>
    );
  } else if (roles.isError) {
    body = <Failure error={roles.error} onRetry={() => void roles.refetch()} />;
  } else {
    body =
      chosen === undefined ? null : (
        <div ref={field}>
          <Select
            label="Role"
            autoFocus
            options={available.map((role) => ({ value: role.id, label: role.name }))}
            value={chosen.id}
            onChange={(event) => setChoice(event.target.value)}
          />
        </div>
      );
    action = actionAfter(
      outcome,
      {
        label: 'Assign',
        pending,
        onConfirm: () => {
          if (chosen !== undefined) onAssign(chosen.id, chosen.name);
        },
        ...(chosen === undefined ? { disabledReason: NO_ROLES_COPY } : {}),
      },
      waitedFor === outcome,
      () => setWaitedFor(outcome),
    );
  }

  return (
    <Dialog open title={`Assign a role to ${fullName(user)}`} onClose={onClose} action={action}>
      {body}
      <OutcomeLine outcome={outcome} />
    </Dialog>
  );
}
