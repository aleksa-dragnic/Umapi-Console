import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import type { User } from '@/features/users/api';
import {
  openedRowOf,
  userPath,
  type DetailEntry,
  type DirectoryReturn,
} from '@/features/users/paths';
import { EntityStatus } from '@/ui/EntityStatus';
import { TableCell, TableRow } from '@/ui/Table';

/**
 * The directory's rows (inventory sections 3.3 and 4). Each row opens the
 * user's detail. The email is a real link to `/users/:id`, so a row can be
 * opened in a new tab or its address copied - a view is a link here, as the
 * directory's filters are - and a click anywhere else on the row follows it.
 *
 * The table is one tab stop: only one row's link is in the tab order, and the
 * arrow keys, Home and End move between rows once one has focus. It stays a
 * table rather than a grid, because a grid promises cell-by-cell navigation
 * and these rows have one thing to do.
 *
 * `selected` is the row whose detail was just open. Before the detail opens,
 * the row is written into the directory's own history entry, so Back returns
 * to a directory that knows it: the row keeps the lifted surface and takes
 * focus again. Nothing is stored anywhere but the browser's history.
 */

function modified(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function DirectoryRows({ users }: { users: readonly User[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const opened = openedRowOf(location.state);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const restored = useRef<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const ids = users.map((user) => user.id);
  const openedHere = opened !== null && ids.includes(opened);
  const stop =
    active !== null && ids.includes(active) ? active : openedHere ? opened : (ids[0] ?? null);

  useEffect(() => {
    // Inventory section 4: returning from a detail puts focus back on its row,
    // once, when that row is on the page.
    if (!openedHere || opened === null || restored.current === opened) return;
    restored.current = opened;
    links.current.get(opened)?.focus();
  }, [opened, openedHere]);

  function focusRow(index: number) {
    const id = ids[Math.max(0, Math.min(index, ids.length - 1))];
    if (id !== undefined) links.current.get(id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    const target =
      event.key === 'ArrowDown'
        ? index + 1
        : event.key === 'ArrowUp'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? ids.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    focusRow(target);
  }

  function onOpen(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.defaultPrevented || modified(event)) return;
    const back: DirectoryReturn = { opened: id };
    void navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: back },
    );
  }

  return users.map((user, index) => {
    const selected = user.id === opened;
    const entry: DetailEntry = { email: user.email, directorySearch: location.search };
    return (
      <TableRow
        key={user.id}
        aria-current={selected ? 'true' : undefined}
        className={['cursor-pointer hover:bg-lift', selected ? 'bg-lift' : undefined]
          .filter(Boolean)
          .join(' ')}
        onClick={(event) => {
          // The link handles its own clicks; a selection being made is not a click.
          if ((event.target as Element).closest('a') !== null) return;
          if ((window.getSelection()?.toString() ?? '') !== '') return;
          links.current.get(user.id)?.click();
        }}
      >
        <TableCell className="font-mono">
          <Link
            ref={(element) => {
              if (element === null) links.current.delete(user.id);
              else links.current.set(user.id, element);
            }}
            to={userPath(user.id)}
            state={entry}
            tabIndex={user.id === stop ? 0 : -1}
            className="text-fg-identifier underline-offset-4 hover:underline"
            onFocus={() => setActive(user.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={(event) => onOpen(event, user.id)}
          >
            {user.email}
          </Link>
        </TableCell>
        <TableCell>{user.firstName}</TableCell>
        <TableCell>{user.lastName}</TableCell>
        <TableCell>
          <EntityStatus status={user.status} />
        </TableCell>
      </TableRow>
    );
  });
}
