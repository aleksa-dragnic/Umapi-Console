import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { toApiQuery, type DirectoryQuery } from '@/features/users/url-state';
import { api, type Schema } from '@/lib/api/client';
import { retryAfterSeconds, toProblem, type Problem } from '@/lib/api/problem';

/**
 * The directory's one request, `GET /api/v1/users`, through TanStack Query
 * (ADR 0010). The key is the directory's URL state, so the address bar and the
 * cache name the same thing. The previous page stays on screen while the next
 * one loads (`loading-refetch`, inventory section 3.3).
 */

export type User = Schema<'UserResponse'>;

/** Row 13: the pagination header, camelCase JSON. */
export interface Pagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface DirectoryPage {
  users: User[];
  pagination: Pagination;
  /** The status of the response that produced this view, for the footer. */
  status: number;
}

export type DirectoryFailure =
  { kind: 'refused'; problem: Problem; retryAfterSeconds: number } | { kind: 'unreachable' };

export class DirectoryError extends Error {
  readonly failure: DirectoryFailure;

  constructor(failure: DirectoryFailure) {
    super(failure.kind === 'refused' ? failure.problem.title : 'No response');
    this.name = 'DirectoryError';
    this.failure = failure;
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

export async function fetchDirectory(
  query: DirectoryQuery,
  signal?: AbortSignal,
): Promise<DirectoryPage> {
  let result;
  try {
    result = await api.GET('/api/v1/users', {
      params: { query: toApiQuery(query) },
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new DirectoryError({ kind: 'unreachable' });
  }
  const { data, error, response } = result;
  if (!response.ok || data === undefined) {
    throw new DirectoryError({
      kind: 'refused',
      problem: toProblem(response, error),
      retryAfterSeconds: retryAfterSeconds(response),
    });
  }
  return {
    users: data,
    pagination: paginationOf(response.headers.get('X-Pagination'), data, query.page),
    status: response.status,
  };
}

export function useDirectory(query: DirectoryQuery) {
  return useQuery({
    queryKey: ['users', 'directory', query],
    queryFn: ({ signal }) => fetchDirectory(query, signal),
    placeholderData: keepPreviousData,
  });
}
