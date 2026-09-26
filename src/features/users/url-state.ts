/**
 * The directory's state, kept in the address bar (inventory section 5): `page`,
 * `q`, `sort` and `status`. An absent parameter means its default and is never
 * written; an invalid value falls back to the default instead of erroring; and
 * any change of filter goes back to page 1.
 */

/** Row 18: the four values the API accepts. */
export const USER_STATUSES = ['Pending', 'Active', 'Locked', 'Deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Row 47's whitelist, less `createdAt`: the list response carries no creation
 * date, so there is no column to show that order by (inventory section 3.3).
 */
export const SORT_FIELDS = ['email', 'firstName', 'lastName', 'status'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface Sort {
  field: SortField;
  direction: SortDirection;
}

export interface DirectoryQuery {
  page: number;
  /** Sent as typed, never trimmed (row 56). Empty means no search. */
  q: string;
  /** Null means the API's own order, which is email ascending (row 47). */
  sort: Sort | null;
  status: UserStatus | null;
}

export const DEFAULT_SORT: Sort = { field: 'email', direction: 'asc' };

function pageOf(value: string | null): number {
  return value !== null && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : 1;
}

function statusOf(value: string | null): UserStatus | null {
  if (value === null) return null;
  return USER_STATUSES.find((status) => status.toLowerCase() === value.toLowerCase()) ?? null;
}

function sortOf(value: string | null): Sort | null {
  const [name, direction, ...rest] = (value ?? '').split(':');
  if (rest.length > 0 || (direction !== 'asc' && direction !== 'desc')) return null;
  const field = SORT_FIELDS.find((candidate) => candidate.toLowerCase() === name?.toLowerCase());
  if (field === undefined) return null;
  return isDefaultSort({ field, direction }) ? null : { field, direction };
}

function isDefaultSort(sort: Sort): boolean {
  return sort.field === DEFAULT_SORT.field && sort.direction === DEFAULT_SORT.direction;
}

export function readQuery(params: URLSearchParams): DirectoryQuery {
  return {
    page: pageOf(params.get('page')),
    q: params.get('q') ?? '',
    sort: sortOf(params.get('sort')),
    status: statusOf(params.get('status')),
  };
}

export function writeQuery(query: DirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.q !== '') params.set('q', query.q);
  if (query.sort !== null && !isDefaultSort(query.sort)) {
    params.set('sort', `${query.sort.field}:${query.sort.direction}`);
  }
  if (query.status !== null) params.set('status', query.status.toLowerCase());
  return params;
}

/** The order the API applies, whether or not one was chosen. */
export function effectiveSort(query: DirectoryQuery): Sort {
  return query.sort ?? DEFAULT_SORT;
}

/** A column header's click: ascending first, then the reverse. */
export function toggledSort(query: DirectoryQuery, field: SortField): Sort | null {
  const current = effectiveSort(query);
  const direction: SortDirection =
    current.field === field && current.direction === 'asc' ? 'desc' : 'asc';
  const next = { field, direction };
  return isDefaultSort(next) ? null : next;
}

/**
 * The query the API is sent (inventory section 5, rows 16, 18, 43): the
 * generated names, which the API binds whatever their case. Defaults are left
 * out, so the API applies its own.
 */
export interface ApiUserQuery {
  PageNumber?: number;
  SearchTerm?: string;
  Status?: string;
  OrderBy?: string;
}

export function toApiQuery(query: DirectoryQuery): ApiUserQuery {
  const api: ApiUserQuery = {};
  if (query.page !== 1) api.PageNumber = query.page;
  if (query.q !== '') api.SearchTerm = query.q;
  if (query.status !== null) api.Status = query.status;
  if (query.sort !== null) api.OrderBy = `${query.sort.field} ${query.sort.direction}`;
  return api;
}
