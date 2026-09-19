import type { AriaAttributes, ReactNode } from 'react';

/**
 * The table shell. It knows rows, cells and the sorting contract, and nothing
 * about where the sort state is kept: collection state lives in the URL, and
 * that wiring belongs to the directory feature rather than to a primitive.
 *
 * A column the API cannot sort by is not clickable, rather than clickable and
 * ignored - see SCREEN-INVENTORY section 3.3.
 */

export type SortDirection = NonNullable<AriaAttributes['aria-sort']>;

export function Table({
  caption,
  children,
  className,
}: {
  /** Names the table for assistive technology; not shown. */
  caption?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <table className={['w-full border-collapse text-app-body', className].filter(Boolean).join(' ')}>
      {caption !== undefined ? <caption className="sr-only">{caption}</caption> : null}
      {children}
    </table>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border-default">{children}</thead>;
}

export function TableBody({ children }: { children?: ReactNode | undefined }) {
  // Children are optional because an empty body is a real state, not a defect:
  // empty-search, empty-filter and empty-page all render the header and no
  // rows. A component that cannot express that forces the feature to render a
  // different table for the empty case.
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <tr
      className={[
        'h-[var(--size-row)] border-b border-border-default',
        'transition-colors duration-[var(--duration-hover)] ease-standard',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </tr>
  );
}

const HEADER = 'h-[var(--size-row)] px-app-3 text-left font-mono text-app-label uppercase text-fg-muted';

export function TableHeaderCell({
  children,
  sort,
  onSort,
}: {
  children: ReactNode;
  /** The current direction. Only meaningful when the column is sortable. */
  sort?: SortDirection | undefined;
  /** Present means the API can sort by this column. Absent means it cannot. */
  onSort?: (() => void) | undefined;
}) {
  const sortable = onSort !== undefined;

  return (
    <th scope="col" className={HEADER} {...(sortable ? { 'aria-sort': sort ?? 'none' } : {})}>
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-app-1 uppercase transition-colors duration-[var(--duration-hover)] ease-standard hover:text-fg-primary"
        >
          {children}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <td className={['px-app-3 text-fg-primary', className].filter(Boolean).join(' ')}>{children}</td>
  );
}