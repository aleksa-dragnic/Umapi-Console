import type { Pagination } from '@/features/users/api';
import { Button } from '@/ui/Button';

/**
 * The directory's footer (inventory section 3.3): the status of the response
 * that produced the rows on screen, what `X-Pagination` says rather than what
 * was asked for, and the pending dot while a search term waits out its
 * debounce. Previous and Next appear only where there is a page to go to; the
 * position is always stated.
 */

export function resultsCopy(status: number, totalCount: number): string {
  return `${status} · ${totalCount} ${totalCount === 1 ? 'result' : 'results'}`;
}

export function pageCopy(pagination: Pagination): string {
  return `Page ${pagination.currentPage} of ${Math.max(1, pagination.totalPages)}`;
}

export function Footer({
  status,
  pagination,
  searchPending,
  paging,
  onPage,
}: {
  status: number;
  pagination: Pagination;
  searchPending: boolean;
  /** False past the last page, where the empty state offers the way back instead. */
  paging: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-app-2 border-t border-border-default pt-app-2 font-mono text-app-meta text-fg-secondary">
      <p className="flex items-center gap-app-1">
        <span>{resultsCopy(status, pagination.totalCount)}</span>
        {searchPending ? (
          <span className="inline-flex items-center gap-app-1">
            <span aria-hidden="true" className="size-1.5 rounded-pill bg-fg-muted" />
            <span className="sr-only">Search pending</span>
          </span>
        ) : null}
      </p>
      {paging ? (
        <div className="flex items-center gap-app-2">
          {pagination.hasPrevious ? (
            <Button onClick={() => onPage(pagination.currentPage - 1)}>Previous</Button>
          ) : null}
          <span>{pageCopy(pagination)}</span>
          {pagination.hasNext ? (
            <Button onClick={() => onPage(pagination.currentPage + 1)}>Next</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
