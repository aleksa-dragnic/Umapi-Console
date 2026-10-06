import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { failureOf, useUser, type UserDetails, type UserRead } from '@/features/users/api';
import {
  PERMISSION_FOR,
  UNCONFIRMED,
  outcomeOf,
  useChangeUser,
  type Action,
  type Change,
  type Outcome,
} from '@/features/users/changes';
import { Failure } from '@/features/users/Failure';
import { detailEntryOf, USERS_PATH, type DirectoryReturn } from '@/features/users/paths';
import { ProfileForm, type ProfileValues } from '@/features/users/ProfileForm';
import {
  AssignRoleDialog,
  ConfirmDialog,
  fullName,
  lockCopy,
  removeRoleCopy,
  unlockCopy,
} from '@/features/users/UserDialogs';
import { useOffline } from '@/lib/api/connection';
import { useCan } from '@/lib/api/permissions';
import type { Problem } from '@/lib/api/problem';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EntityStatus } from '@/ui/EntityStatus';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/ui/Table';

/**
 * The `users/:id` screen (inventory section 3.4). Application density. Three
 * panels from the v1 detail (row 21) - identity, roles, concurrency - and the
 * four writes of build plan section 6.3, each behind its own permission and
 * each disabled with its reason when the token lacks it (section 2.6).
 *
 * What the API answers decides what the screen does, never the screen's own
 * idea of the record: a Deactivated user is offered every action, and the
 * API's 400 is shown as the rule it is; a stale tab meets the API's 409 as a
 * conflict with Reload, not a toast; a 403 disables the control that earned it
 * (section 2.5). Profile edits are last-write-wins, and the concurrency panel
 * says so (decision 12).
 */

export const NOT_FOUND_COPY = 'No user with that id.';
export const BACK_COPY = 'Back to users';
export const CONFLICT_COPY =
  'This record changed since it was read. Reload to see the current version, then apply the change again.';
export const CONCURRENCY_COPY =
  'This tag lets the console ask whether the record changed. It does not protect an edit: the API does not check versions, so the last save wins.';
export const NO_ETAG_COPY = 'The response carried no ETag.';
export const NOT_MODIFIED_COPY =
  'The last read answered 304 Not Modified: the record has not changed since this tag.';
export const FORBIDDEN_REASON = 'The API refused this action for this account.';
/** Inventory section 2.2: no write is offered while the API cannot be reached. */
export const OFFLINE_REASON = 'No connection to the API.';
export const forbiddenCopy = (action: string, problem: Problem) =>
  `${action} was refused: ${problem.status} ${problem.title}.`;

const ACTION_NAME: Record<Action, string> = {
  edit: 'Saving the profile',
  lock: 'Locking or unlocking',
  'assign-role': 'Assigning a role',
  'remove-role': 'Removing a role',
};

/** A server timestamp as the server wrote it, to the minute, in UTC. */
export function formatUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

type Dialogs =
  | { kind: 'lock' }
  | { kind: 'unlock' }
  | { kind: 'assign' }
  | { kind: 'remove'; roleId: string; role: string };

const IDENTITY_CHANGES: ReadonlyArray<Change['kind']> = ['update', 'lock', 'unlock'];

function Saving() {
  return (
    <p role="status" className="flex items-center gap-app-1 font-mono text-app-meta text-fg-muted">
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-fg-muted" />
      Saving
    </p>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div aria-hidden="true" className="mt-app-2 flex flex-col gap-app-2">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="block h-2 w-3/4 rounded-control bg-lift" />
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-app-1">
      <dt className="font-mono text-app-label uppercase text-fg-muted">{label}</dt>
      <dd className="text-fg-primary">{children}</dd>
    </div>
  );
}

function Notice({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-app-2">
      <p className="text-fg-danger">{children}</p>
      <Button onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

/**
 * The way back to the directory, to the view the user came from, with the row
 * marked as the one that was opened - the same state Back finds.
 */
function BackLink({ id, search }: { id: string; search: string }) {
  const back: DirectoryReturn = { opened: id };
  return (
    <Link
      to={{ pathname: USERS_PATH, search }}
      state={back}
      className="w-fit font-mono text-app-meta text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
    >
      {BACK_COPY}
    </Link>
  );
}

export function DetailScreen() {
  const { id = '' } = useParams();
  const location = useLocation();
  const entry = detailEntryOf(location.state);
  const read = useUser(id);
  const change = useChangeUser(id);
  const heading = useRef<HTMLHeadingElement>(null);

  const canEdit = useCan(PERMISSION_FOR.edit);
  const canLock = useCan(PERMISSION_FOR.lock);
  const canManageRoles = useCan(PERMISSION_FOR['assign-role']);
  const offline = useOffline();

  const [editing, setEditing] = useState<{ values: ProfileValues; outcome: Outcome | null } | null>(
    null,
  );
  const [dialog, setDialog] = useState<Dialogs | null>(null);
  const [dialogOutcome, setDialogOutcome] = useState<Outcome | null>(null);
  const [conflict, setConflict] = useState<Problem | null>(null);
  const [forbidden, setForbidden] = useState<Action[]>([]);
  const [notice, setNotice] = useState<{ action: Action; problem: Problem } | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const returnToEdit = useRef(false);

  useEffect(() => {
    // Inventory section 4: activating a row lands on this screen's heading.
    heading.current?.focus();
  }, [id]);

  useEffect(() => {
    // The form closing - saved or cancelled - returns focus to Edit.
    if (editing === null && returnToEdit.current) {
      returnToEdit.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  const data: UserRead | undefined = read.data;
  const user = data?.user;
  const saving = change.isPending;
  const savingIdentity =
    saving && change.variables !== undefined && IDENTITY_CHANGES.includes(change.variables.kind);
  const savingRoles = saving && !savingIdentity;

  function reasonFor(action: Action): string | undefined {
    const permit = action === 'edit' ? canEdit : action === 'lock' ? canLock : canManageRoles;
    if (!permit.allowed) return permit.reason;
    if (forbidden.includes(action)) return FORBIDDEN_REASON;
    return offline ? OFFLINE_REASON : undefined;
  }

  function forbid(action: Action, problem: Problem) {
    setForbidden((current) => (current.includes(action) ? current : [...current, action]));
    setNotice({ action, problem });
  }

  /** Where an answer that is not the form's or the dialog's goes. True when it went. */
  function settleElsewhere(action: Action, outcome: Outcome): boolean {
    if (outcome.kind === 'conflict') {
      setConflict(outcome.problem);
      return true;
    }
    if (outcome.kind === 'forbidden') {
      forbid(action, outcome.problem);
      return true;
    }
    return false;
  }

  async function save(values: ProfileValues) {
    if (user === undefined) return;
    returnToEdit.current = true;
    setEditing(null);
    if (
      values.email === user.email &&
      values.firstName === user.firstName &&
      values.lastName === user.lastName
    ) {
      return;
    }
    try {
      await change.mutateAsync({ kind: 'update', ...values });
    } catch (error) {
      const outcome = outcomeOf(error);
      if (!settleElsewhere('edit', outcome)) {
        returnToEdit.current = false;
        setEditing({ values, outcome });
      }
    }
  }

  async function confirm(action: Action, next: Change) {
    setDialogOutcome(null);
    try {
      await change.mutateAsync(next);
      setDialog(null);
    } catch (error) {
      const outcome = outcomeOf(error);
      if (settleElsewhere(action, outcome)) setDialog(null);
      else setDialogOutcome(outcome);
    }
  }

  function open(next: Dialogs) {
    setDialogOutcome(null);
    setDialog(next);
  }

  function reload() {
    setConflict(null);
    void read.refetch();
  }

  const failure = read.isError && data === undefined ? failureOf(read.error) : null;
  const notFound = failure?.kind === 'refused' && failure.problem.status === 404;

  let content: ReactNode;
  if (notFound) {
    content = (
      <div role="alert" className="flex flex-col items-start gap-app-2">
        <p className="text-fg-primary">{NOT_FOUND_COPY}</p>
      </div>
    );
  } else if (failure !== null) {
    content = (
      <Card title="User">
        <Failure key={read.errorUpdatedAt} error={read.error} onRetry={() => void read.refetch()} />
      </Card>
    );
  } else if (user === undefined || data === undefined) {
    content = (
      <>
        <Card title="Identity">
          <Skeleton lines={6} />
        </Card>
        <Card title="Roles">
          <Skeleton lines={2} />
        </Card>
        <Card title="Concurrency">
          <Skeleton lines={2} />
        </Card>
      </>
    );
  } else {
    content = (
      <>
        {read.isError ? (
          <Failure
            key={read.errorUpdatedAt}
            error={read.error}
            onRetry={() => void read.refetch()}
          />
        ) : null}
        {conflict === null ? null : (
          <Card title="Conflict">
            <div role="alert" className="mt-app-2 flex flex-col items-start gap-app-2">
              {conflict.detail === undefined ? null : (
                <p className="text-fg-primary">{conflict.detail}</p>
              )}
              <p className="text-fg-secondary">{CONFLICT_COPY}</p>
              <Button onClick={reload}>Reload</Button>
            </div>
          </Card>
        )}
        <IdentityPanel
          user={user}
          saving={savingIdentity}
          editing={editing}
          editButton={editButton}
          busy={saving}
          reasonFor={reasonFor}
          notice={
            notice !== null && notice.action !== 'assign-role' && notice.action !== 'remove-role'
              ? notice
              : null
          }
          onDismiss={() => setNotice(null)}
          onEdit={() =>
            setEditing({
              values: { email: user.email, firstName: user.firstName, lastName: user.lastName },
              outcome: null,
            })
          }
          onSave={(values) => void save(values)}
          onCancel={() => {
            returnToEdit.current = true;
            setEditing(null);
          }}
          onLock={() => open({ kind: user.status === 'Locked' ? 'unlock' : 'lock' })}
        />
        <RolesPanel
          user={user}
          saving={savingRoles}
          busy={saving}
          reasonFor={reasonFor}
          notice={
            notice !== null && (notice.action === 'assign-role' || notice.action === 'remove-role')
              ? notice
              : null
          }
          onDismiss={() => setNotice(null)}
          onAssign={() => open({ kind: 'assign' })}
          onRemove={(roleId, role) => open({ kind: 'remove', roleId, role })}
        />
        <Card title="Concurrency">
          <div className="mt-app-2 flex flex-col gap-app-2">
            {saving ? <Saving /> : null}
            <dl>
              <Field label="ETag">
                {data.etag === null ? (
                  <span className="text-fg-secondary">{NO_ETAG_COPY}</span>
                ) : (
                  <span className="font-mono text-fg-identifier">{data.etag}</span>
                )}
              </Field>
            </dl>
            {data.status === 304 ? (
              // Section 2.9: a 304 is shown, not hidden. It is what the tag is for.
              <p className="text-fg-primary">{NOT_MODIFIED_COPY}</p>
            ) : null}
            <p className="text-fg-secondary">{CONCURRENCY_COPY}</p>
          </div>
        </Card>
      </>
    );
  }

  const name = user === undefined ? '' : fullName(user);
  const email = user?.email ?? entry?.email;

  return (
    <main
      aria-busy={read.isFetching}
      className="mx-auto flex w-full max-w-3xl flex-col gap-app-4 p-app-4"
    >
      <BackLink id={id} search={entry?.directorySearch ?? ''} />
      <h1
        ref={heading}
        tabIndex={-1}
        className={
          email === undefined
            ? 'text-app-title text-fg-emphasis'
            : 'font-mono text-app-title text-fg-identifier'
        }
      >
        {email ?? 'User'}
      </h1>
      {content}

      {user !== undefined && dialog?.kind === 'lock' ? (
        <ConfirmDialog
          title={`Lock ${name}`}
          copy={lockCopy(name)}
          label="Lock"
          destructive
          pending={saving}
          outcome={dialogOutcome}
          onConfirm={() => void confirm('lock', { kind: 'lock' })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {user !== undefined && dialog?.kind === 'unlock' ? (
        <ConfirmDialog
          title={`Unlock ${name}`}
          copy={unlockCopy(name)}
          label="Unlock"
          destructive={false}
          pending={saving}
          outcome={dialogOutcome}
          onConfirm={() => void confirm('lock', { kind: 'unlock' })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {user !== undefined && dialog?.kind === 'remove' ? (
        <ConfirmDialog
          title={`Remove ${dialog.role} from ${name}`}
          copy={removeRoleCopy(name, dialog.role)}
          label="Remove"
          destructive
          pending={saving}
          outcome={dialogOutcome}
          onConfirm={() =>
            void confirm('remove-role', { kind: 'remove-role', roleId: dialog.roleId })
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
      {user !== undefined && dialog?.kind === 'assign' ? (
        <AssignRoleDialog
          user={user}
          pending={saving}
          outcome={dialogOutcome}
          onAssign={(roleId, role) =>
            void confirm('assign-role', { kind: 'assign-role', roleId, name: role })
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
    </main>
  );
}

function IdentityPanel({
  user,
  saving,
  busy,
  editing,
  editButton,
  reasonFor,
  notice,
  onDismiss,
  onEdit,
  onSave,
  onCancel,
  onLock,
}: {
  user: UserDetails;
  saving: boolean;
  busy: boolean;
  editing: { values: ProfileValues; outcome: Outcome | null } | null;
  editButton: RefObject<HTMLButtonElement | null>;
  reasonFor: (action: Action) => string | undefined;
  notice: { action: Action; problem: Problem } | null;
  onDismiss: () => void;
  onEdit: () => void;
  onSave: (values: ProfileValues) => void;
  onCancel: () => void;
  onLock: () => void;
}) {
  return (
    <Card title="Identity">
      <div className="mt-app-2 flex flex-col gap-app-3">
        {saving ? <Saving /> : null}
        {editing === null ? (
          <dl className="grid grid-cols-1 gap-app-3 sm:grid-cols-2">
            <Field label="Email">
              <span className="font-mono text-fg-identifier">{user.email}</span>
            </Field>
            <Field label="Status">
              <EntityStatus status={user.status} />
            </Field>
            <Field label="First name">{user.firstName}</Field>
            <Field label="Last name">{user.lastName}</Field>
            <Field label="Created">
              <span className="font-mono text-app-meta">{formatUtc(user.createdAtUtc)}</span>
            </Field>
            <Field label="Updated">
              <span className="font-mono text-app-meta">{formatUtc(user.updatedAtUtc)}</span>
            </Field>
          </dl>
        ) : (
          <ProfileForm
            initial={editing.values}
            outcome={editing.outcome}
            onSave={onSave}
            onCancel={onCancel}
          />
        )}
        {notice === null ? null : (
          <Notice onDismiss={onDismiss}>
            {forbiddenCopy(ACTION_NAME[notice.action], notice.problem)}
          </Notice>
        )}
        {editing === null ? (
          <div className="flex flex-wrap items-start gap-app-2">
            <Button
              ref={editButton}
              pending={busy}
              disabledReason={reasonFor('edit')}
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              variant={user.status === 'Locked' ? 'ghost' : 'destructive'}
              pending={busy}
              disabledReason={reasonFor('lock')}
              onClick={onLock}
            >
              {user.status === 'Locked' ? 'Unlock' : 'Lock'}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function RolesPanel({
  user,
  saving,
  busy,
  reasonFor,
  notice,
  onDismiss,
  onAssign,
  onRemove,
}: {
  user: UserDetails;
  saving: boolean;
  busy: boolean;
  reasonFor: (action: Action) => string | undefined;
  notice: { action: Action; problem: Problem } | null;
  onDismiss: () => void;
  onAssign: () => void;
  onRemove: (roleId: string, role: string) => void;
}) {
  const removeReason = reasonFor('remove-role');
  return (
    <Card title="Roles">
      <div className="mt-app-2 flex flex-col gap-app-3">
        {saving ? <Saving /> : null}
        {/* A role's name and time never break. The reason under Remove wraps
            within a column at least 16rem wide, so the table fits its card at
            desktop width and scrolls, rather than squeezing, at 380px. */}
        <div className="overflow-x-auto whitespace-nowrap">
          <Table caption="Roles">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Assigned</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {user.roles.map((role) => (
                <TableRow key={role.roleId}>
                  <TableCell>{role.name}</TableCell>
                  <TableCell className="font-mono text-app-meta">
                    {role.assignedAtUtc === UNCONFIRMED ? 'pending' : formatUtc(role.assignedAtUtc)}
                  </TableCell>
                  <TableCell className="min-w-64 py-app-1 whitespace-normal">
                    <Button
                      variant="destructive"
                      aria-label={`Remove ${role.name}`}
                      pending={busy}
                      disabledReason={removeReason}
                      onClick={() => onRemove(role.roleId, role.name)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {notice === null ? null : (
          <Notice onDismiss={onDismiss}>
            {forbiddenCopy(ACTION_NAME[notice.action], notice.problem)}
          </Notice>
        )}
        <div>
          <Button pending={busy} disabledReason={reasonFor('assign-role')} onClick={onAssign}>
            Assign role
          </Button>
        </div>
      </div>
    </Card>
  );
}
