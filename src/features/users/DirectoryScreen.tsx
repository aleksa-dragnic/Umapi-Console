import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { DirectoryError, useDirectory, type DirectoryPage } from '@/features/users/api';
import { Footer } from '@/features/users/Footer';
import { Toolbar } from '@/features/users/Toolbar';
import {
  effectiveSort,
  readQuery,
  toggledSort,
  writeQuery,
  type DirectoryQuery,
  type SortField,
  type UserStatus,
} from '@/features/users/url-state';
import { Button } from '@/ui/Button';
import { EntityStatus } from '@/ui/EntityStatus';
import { RateLimitNotice } from '@/ui/RateLimitNotice';
import { SkeletonRow } from '@/ui/SkeletonRow';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/ui/Table';

/**
 * The `users` screen, the directory (inventory section 3.3). Application
 * density. Everything that decides what is shown - page, search, sort, status
 * filter - lives in the address bar (section 5), so a link reproduces the view
 * and a reload keeps it. Every state below is a row of that table, and the copy
 * is the inventory's.
 *
 * Rows are not yet interactive: activating one opens the user's detail, and the
 * detail route, keyboard traversal and the focused and selected row states
 * arrive together in PR 13.
 */

export const USERS_PATH = '/users';
const SEARCH_DEBOUNCE_MS = 300;
const COLUMNS: ReadonlyArray<{ field: SortField; label: string }> = [
  { field: 'email', label: 'Email' },
  { field: 'firstName', label: 'First name' },
  { field: 'lastName', label: 'Last name' },
  { field: 'status', label: 'Status' },
];

export const emptySearchCopy = (term: string) => `No users match "${term}".`;
export const emptyFilterCopy = (status: UserStatus) => `No users with status ${status}.`;
export function emptyPageCopy(page: number, totalPages: number): string {
  const there = totalPages === 1 ? 'There is 1 page.' : `There are ${totalPages} pages.`;
  return `Page ${page} is past the end. ${there}`;
}
export const NO_USERS_COPY = 'No users.';
export const UNREACHABLE_COPY = 'No response from the API.';

export interface EmptyState {
  message: string;
  action: { label: string; next: DirectoryQuery } | null;
}

/** Which empty state a page with no rows is, in the inventory's order. */
export function emptyStateOf(data: DirectoryPage, query: DirectoryQuery): EmptyState {
  if (data.pagination.totalCount > 0) {
    return {
      message: emptyPageCopy(query.page, data.pagination.totalPages),
      action: { label: 'Go to page 1', next: { ...query, page: 1 } },
    };
  }
  if (query.q !== '') {
    return {
      message: emptySearchCopy(query.q),
      action: { label: 'Clear search', next: { ...query, q: '', page: 1 } },
    };
  }
  if (query.status !== null) {
    return {
      message: emptyFilterCopy(query.status),
      action: { label: 'Clear filter', next: { ...query, status: null, page: 1 } },
    };
  }
  return { message: NO_USERS_COPY, action: null };
}

function Empty({
  data,
  query,
  onChange,
}: {
  data: DirectoryPage;
  query: DirectoryQuery;
  onChange: (next: DirectoryQuery) => void;
}) {
  const { message, action } = emptyStateOf(data, query);
  return (
    <div className="flex flex-col items-start gap-app-2 p-app-3">
      <p className="text-fg-secondary">{message}</p>
      {action === null ? null : (
        <Button onClick={() => onChange(action.next)}>{action.label}</Button>
      )}
    </div>
  );
}

function Failure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const [elapsedFor, setElapsedFor] = useState<unknown>(null);
  const failure =
    error instanceof DirectoryError ? error.failure : { kind: 'unreachable' as const };

  if (failure.kind === 'unreachable') {
    return (
      <div role="alert" className="flex flex-col items-start gap-app-2 p-app-3">
        <p className="text-fg-primary">{UNREACHABLE_COPY}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    );
  }

  const { problem } = failure;
  const limited = problem.status === 429 && elapsedFor !== error;
  return (
    <div role="alert" className="flex flex-col items-start gap-app-2 p-app-3">
      <p className="text-fg-primary">
        <span className="font-mono">{problem.status}</span> {problem.title}
      </p>
      {problem.traceId === undefined ? null : (
        <p className="font-mono text-app-meta text-fg-secondary">{problem.traceId}</p>
      )}
      <Button
        onClick={onRetry}
        disabledReason={
          limited ? (
            <RateLimitNotice
              seconds={failure.retryAfterSeconds}
              onElapsed={() => setElapsedFor(error)}
            />
          ) : undefined
        }
      >
        Retry
      </Button>
    </div>
  );
}

export function DirectoryScreen() {
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const query = readQuery(params);
  const directory = useDirectory(query);

  // The field shows what is typed; the address bar gets it after the debounce.
  // A change that comes from the address bar - Back, Clear search - resets it.
  const [term, setTerm] = useState(query.q);
  const [committed, setCommitted] = useState(query.q);
  if (committed !== query.q) {
    setCommitted(query.q);
    setTerm(query.q);
  }

  function change(next: DirectoryQuery, replace = false) {
    setParams(writeQuery(next), { replace });
  }

  useEffect(() => {
    const current = readQuery(new URLSearchParams(search));
    if (term === current.q) return;
    const timer = setTimeout(() => {
      // Typing is one edit, not a history entry per pause.
      setParams(writeQuery({ ...current, q: term, page: 1 }), { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, search, setParams]);

  const sort = effectiveSort(query);
  const data = directory.data;
  const refetching = directory.isPlaceholderData;

  let body;
  if (directory.isError) {
    body = (
      <Failure
        key={directory.errorUpdatedAt}
        error={directory.error}
        onRetry={() => void directory.refetch()}
      />
    );
  } else {
    body = (
      <>
        <div className="overflow-x-auto">
          <Table caption="Users" className={refetching ? 'opacity-60' : undefined}>
            <TableHead>
              <TableRow>
                {COLUMNS.map(({ field, label }) => (
                  <TableHeaderCell
                    key={field}
                    sort={
                      sort.field === field
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    onSort={() => change({ ...query, sort: toggledSort(query, field), page: 1 })}
                  >
                    {label}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data === undefined
                ? Array.from({ length: 10 }, (_, index) => (
                    <SkeletonRow key={index} columns={COLUMNS.length} />
                  ))
                : data.users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-lift">
                      <TableCell className="font-mono text-fg-identifier">{user.email}</TableCell>
                      <TableCell>{user.firstName}</TableCell>
                      <TableCell>{user.lastName}</TableCell>
                      <TableCell>
                        <EntityStatus status={user.status} />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
        {data !== undefined && data.users.length === 0 ? (
          <Empty data={data} query={query} onChange={(next) => change(next)} />
        ) : null}
        {data === undefined ? null : (
          <Footer
            status={data.status}
            pagination={data.pagination}
            searchPending={term !== query.q}
            paging={data.users.length > 0 || data.pagination.totalCount === 0}
            onPage={(page) => change({ ...query, page })}
          />
        )}
      </>
    );
  }

  return (
    <main
      aria-busy={directory.isFetching}
      className="mx-auto flex w-full max-w-5xl flex-col gap-app-4 p-app-4"
    >
      <h1 tabIndex={-1} className="text-app-title text-fg-emphasis">
        Users
      </h1>
      <Toolbar
        term={term}
        onTermChange={setTerm}
        status={query.status}
        onStatusChange={(status) => change({ ...query, status, page: 1 })}
      />
      {body}
    </main>
  );
}
