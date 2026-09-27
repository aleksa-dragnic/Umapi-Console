/**
 * The users feature's addresses, and what one screen hands the other in the
 * history entry's state. Nothing here is kept anywhere but the browser's
 * history: a reload keeps it, a new tab does not need it.
 */

export const USERS_PATH = '/users';
export const USER_PATH = '/users/:id';

export function userPath(id: string): string {
  return `${USERS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * Handed to the detail by the row that opened it: the email for the header
 * while the detail loads (inventory section 3.4), and the directory's query
 * string, so the way back returns to the same view.
 */
export interface DetailEntry {
  email: string;
  directorySearch: string;
}

/**
 * Written into the directory's own history entry just before a row opens the
 * detail, so Back lands on a directory that knows which row was opened: the
 * `selected` row of inventory section 3.3, and where focus returns (section 4).
 */
export interface DirectoryReturn {
  opened: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function detailEntryOf(state: unknown): DetailEntry | null {
  if (!isRecord(state)) return null;
  const { email, directorySearch } = state;
  return typeof email === 'string' && typeof directorySearch === 'string'
    ? { email, directorySearch }
    : null;
}

export function openedRowOf(state: unknown): string | null {
  if (!isRecord(state)) return null;
  return typeof state['opened'] === 'string' ? state['opened'] : null;
}
