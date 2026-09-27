import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { toApiQuery, type DirectoryQuery } from '@/features/users/url-state';
import { api, type Schema } from '@/lib/api/client';
import { retryAfterSeconds, toProblem, type Problem } from '@/lib/api/problem';

/**
 * The users feature's reads, through TanStack Query (ADR 0010): the directory's
 * page, one user's detail, and the roles the assign dialog offers. The query
 * keys start with `users`, so a write can invalidate every read of a user in
 * one call. The previous page stays on screen while the next one loads
 * (`loading-refetch`, inventory section 3.3).
 *
 * Every read is conditional once its key has been read before (ADR 0013). The
 * `ETag` is kept with the data it validates, in the cache entry itself, and
 * sent back as `If-None-Match`; a 304 (rows 23, 24) keeps that data and says
 * so, instead of being turned into a 200 by anyone along the way. Nothing
 * keeps a validator apart from its body, so the two cannot disagree.
 */

export type User = Schema<'UserResponse'>;
export type UserDetails = Schema<'UserDetailsResponse'>;
export type Role = Schema<'RoleResponse'>;

export const USERS_KEY = ['users'] as const;
export const DIRECTORY_KEY = ['users', 'directory'] as const;
export const detailKey = (id: string) => ['users', 'detail', id] as const;
export const ROLES_KEY = ['roles'] as const;

/** Row 13: the pagination header, camelCase JSON. */
export interface Pagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/** What every read keeps beside its body. */
export interface Validated {
  /** 200, or 304 when the API confirmed the data already held (section 2.9). */
  status: number;
  /** Exactly as received, `W/` prefix included (row 22); null when absent. */
  etag: string | null;
}

export interface DirectoryPage extends Validated {
  users: User[];
  pagination: Pagination;
}

/** A user's detail as read, with the validator it came with. */
export interface UserRead extends Validated {
  user: UserDetails;
}

export interface RolesRead extends Validated {
  roles: Role[];
}

/** Why a request produced no data: the API refused it, or nothing answered. */
export type RequestFailure =
  { kind: 'refused'; problem: Problem; retryAfterSeconds: number } | { kind: 'unreachable' };

export class RequestError extends Error {
  readonly failure: RequestFailure;

  constructor(failure: RequestFailure) {
    super(failure.kind === 'refused' ? failure.problem.title : 'No response');
    this.name = 'RequestError';
    this.failure = failure;
  }
}

/** The failure a thrown value stands for. Anything unexpected is treated as no answer. */
export function failureOf(error: unknown): RequestFailure {
  return error instanceof RequestError ? error.failure : { kind: 'unreachable' };
}

export function refused(response: Response, body: unknown): RequestError {
  return new RequestError({
    kind: 'refused',
    problem: toProblem(response, body),
    retryAfterSeconds: retryAfterSeconds(response),
  });
}

/**
 * Runs one request and turns a transport failure into `unreachable`. An abort
 * is passed on as it is: the query it belonged to is no longer on screen.
 */
export async function send<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new RequestError({ kind: 'unreachable' });
  }
}

function numberIn(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * The header as the footer reports it. A header that is missing or unreadable
 * describes the one page that arrived, rather than inventing a total.
 */
function parsedHeader(header: string | null): unknown {
  if (header === null) return null;
  try {
    return JSON.parse(header);
  } catch {
    return null;
  }
}

export function paginationOf(header: string | null, users: User[], page: number): Pagination {
  const parsed = parsedHeader(header);
  const record =
    typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const currentPage = numberIn(record, 'currentPage') ?? page;
  const totalPages = numberIn(record, 'totalPages') ?? 1;
  return {
    currentPage,
    totalPages,
    pageSize: numberIn(record, 'pageSize') ?? users.length,
    totalCount: numberIn(record, 'totalCount') ?? users.length,
    hasPrevious:
      typeof record['hasPrevious'] === 'boolean' ? record['hasPrevious'] : currentPage > 1,
    hasNext: typeof record['hasNext'] === 'boolean' ? record['hasNext'] : currentPage < totalPages,
  };
}

const withSignal = (signal?: AbortSignal) => (signal === undefined ? {} : { signal });

/** `If-None-Match` for a key read before, and nothing for one that was not. */
function validating(previous: Validated | undefined) {
  const etag = previous?.etag ?? null;
  return etag === null ? {} : { headers: { 'If-None-Match': etag } };
}

/**
 * The data already held, confirmed by a 304. Its body is the same object, so
 * nothing on screen re-renders; only the status the screen reports changes.
 * A 304 without a new `ETag` keeps the one that was sent (row 44: the API
 * compares weakly, so the tag it would send is the tag it matched).
 */
function confirmed<T extends Validated>(previous: T, response: Response): T {
  return { ...previous, status: 304, etag: response.headers.get('ETag') ?? previous.etag };
}

export async function fetchDirectory(
  query: DirectoryQuery,
  signal?: AbortSignal,
  previous?: DirectoryPage,
): Promise<DirectoryPage> {
  const { data, error, response } = await send(
    () =>
      api.GET('/api/v1/users', {
        params: { query: toApiQuery(query) },
        ...validating(previous),
        ...withSignal(signal),
      }),
    signal,
  );
  // Row 44: the tag covers `X-Pagination` as well, so a 304 confirms the page
  // and its position together.
  if (response.status === 304 && previous !== undefined) return confirmed(previous, response);
  if (!response.ok || data === undefined) throw refused(response, error);
  return {
    users: data,
    pagination: paginationOf(response.headers.get('X-Pagination'), data, query.page),
    status: response.status,
    etag: response.headers.get('ETag'),
  };
}

export function useDirectory(query: DirectoryQuery) {
  return useQuery({
    queryKey: [...DIRECTORY_KEY, query],
    queryFn: ({ signal, client, queryKey }) =>
      fetchDirectory(query, signal, client.getQueryData<DirectoryPage>(queryKey)),
    placeholderData: keepPreviousData,
  });
}

/** `GET /api/v1/users/{id}`, the v1 detail (row 21). A 404 is `not-found`. */
export async function fetchUser(
  id: string,
  signal?: AbortSignal,
  previous?: UserRead,
): Promise<UserRead> {
  const { data, error, response } = await send(
    () =>
      api.GET('/api/v1/users/{id}', {
        params: { path: { id } },
        ...validating(previous),
        ...withSignal(signal),
      }),
    signal,
  );
  if (response.status === 304 && previous !== undefined) return confirmed(previous, response);
  if (!response.ok || data === undefined) throw refused(response, error);
  return { user: data, status: response.status, etag: response.headers.get('ETag') };
}

export function useUser(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: ({ signal, client, queryKey }) =>
      fetchUser(id, signal, client.getQueryData<UserRead>(queryKey)),
  });
}

/** `GET /api/v1/roles` (row 48: `roles.read`). Read when the assign dialog opens. */
export async function fetchRoles(signal?: AbortSignal, previous?: RolesRead): Promise<RolesRead> {
  const { data, error, response } = await send(
    () => api.GET('/api/v1/roles', { ...validating(previous), ...withSignal(signal) }),
    signal,
  );
  if (response.status === 304 && previous !== undefined) return confirmed(previous, response);
  if (!response.ok || data === undefined) throw refused(response, error);
  return { roles: data, status: response.status, etag: response.headers.get('ETag') };
}

export function useRoles(enabled: boolean) {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: ({ signal, client, queryKey }) =>
      fetchRoles(signal, client.getQueryData<RolesRead>(queryKey)),
    enabled,
  });
}
