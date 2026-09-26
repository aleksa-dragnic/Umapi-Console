/**
 * A table row standing in for data that has not arrived: the directory's
 * `loading-first` state (inventory section 3.3). It has the real row height, so
 * the table does not jump when the rows replace it, and it is hidden from
 * assistive technology, which is told the table is busy instead.
 */
export function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr aria-hidden="true" className="h-[var(--size-row)] border-b border-border-default">
      {Array.from({ length: columns }, (_, index) => (
        <td key={index} className="px-app-3">
          <span className="block h-2 w-3/4 rounded-control bg-lift" />
        </td>
      ))}
    </tr>
  );
}
