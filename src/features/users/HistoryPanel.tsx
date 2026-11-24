import { useHistory, type HistoryEntry } from '@/features/users/api';
import { Failure } from '@/features/users/Failure';
import { formatUtc } from '@/features/users/format';
import { Card } from '@/ui/Card';

/**
 * A user's history (inventory section 3.4, #87): every change the API recorded,
 * newest first, as a sentence, then who made it and when. The API keeps field
 * names, never values (its ADR 0025), so a change says what moved, not from
 * what to what - and the panel says so. A write anywhere on the detail reads
 * the detail again, and this with it: the key sits under the detail's.
 */

export const HISTORY_EMPTY_COPY = 'No changes recorded.';
export const HISTORY_NOTE_COPY = 'Field names only: the API does not keep values.';
export const SYSTEM_ACTOR = 'system';
export const REMOVED_ACTOR = 'a removed user';
/** The API's limit (its ADR 0025). */
export const HISTORY_LIMIT = 100;

const FIELD_NAMES: Record<string, string> = {
  email: 'email',
  firstName: 'first name',
  lastName: 'last name',
  password: 'password',
  status: 'status',
};

function fieldName(field: string): string {
  return FIELD_NAMES[field] ?? field;
}

/** "email", "email and last name", "email, first name and last name". */
function listed(fields: string[]): string {
  const names = fields.map(fieldName);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

function roleOf(entry: HistoryEntry): string {
  return entry.roleName ?? 'that no longer exists';
}

/** What a change did, as a sentence. */
export function describe(entry: HistoryEntry): string {
  switch (entry.action) {
    case 'registered':
      return 'Registered';
    case 'deleted':
      return 'Deleted';
    case 'roleAssigned':
      return `Role ${roleOf(entry)} assigned`;
    case 'roleRemoved':
      return `Role ${roleOf(entry)} removed`;
    case 'updated': {
      const fields = entry.fields ?? [];
      if (fields.length === 1 && fields[0] === 'status') return 'Status changed';
      if (fields.length === 1 && fields[0] === 'password') return 'Password changed';
      return `Profile changed: ${listed(fields)}`;
    }
    default:
      return entry.action;
  }
}

/** Who made a change: their email, the seeder, or a user who is gone. */
export function actorOf(entry: HistoryEntry): string {
  if (entry.actorEmail !== null && entry.actorEmail !== undefined) return entry.actorEmail;
  return entry.actorId === null || entry.actorId === undefined ? SYSTEM_ACTOR : REMOVED_ACTOR;
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="mt-app-2 flex flex-col gap-app-2">
      {[0, 1, 2].map((index) => (
        <span key={index} className="block h-2 w-3/4 rounded-control bg-lift" />
      ))}
    </div>
  );
}

export function HistoryPanel({ id }: { id: string }) {
  const read = useHistory(id);
  const data = read.data;

  if (data === undefined) {
    return (
      <Card title="History">
        {read.isError ? (
          <Failure
            key={read.errorUpdatedAt}
            error={read.error}
            onRetry={() => void read.refetch()}
          />
        ) : (
          <Skeleton />
        )}
      </Card>
    );
  }

  const count = data.entries.length;
  return (
    <Card title="History">
      {read.isError ? (
        <Failure key={read.errorUpdatedAt} error={read.error} onRetry={() => void read.refetch()} />
      ) : null}
      {count === 0 ? (
        <p className="mt-app-2 text-fg-secondary">{HISTORY_EMPTY_COPY}</p>
      ) : (
        <ol aria-label="Changes, newest first" className="mt-app-3 flex flex-col">
          {data.entries.map((entry, index) => (
            <li
              key={`${entry.occurredAtUtc} ${String(index)}`}
              className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-app-2 pb-app-3 last:pb-0"
            >
              {index < count - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-app-3 bottom-0 left-[0.4rem] border-l border-border-default"
                />
              ) : null}
              <span
                aria-hidden="true"
                className="relative mt-1.5 size-2 rounded-pill border border-fg-muted bg-canvas"
              />
              <div className="flex min-w-0 flex-col">
                <p className="text-fg-primary">{describe(entry)}</p>
                <p className="font-mono text-app-meta text-fg-secondary">
                  {actorOf(entry)} · {formatUtc(entry.occurredAtUtc)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-app-3 text-app-meta text-fg-muted">{HISTORY_NOTE_COPY}</p>
      <p className="mt-app-1 font-mono text-app-meta text-fg-secondary">
        {data.status} · {count === 1 ? '1 change' : `${String(count)} changes`}
        {count === HISTORY_LIMIT ? ` (the latest ${String(HISTORY_LIMIT)})` : ''}
      </p>
    </Card>
  );
}
