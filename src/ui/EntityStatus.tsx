/**
 * A user's own status, which is not an HTTP status (DESIGN-DECISIONS section
 * 10). It is rendered without colour: Active and Pending differ by value, not
 * hue, and the two states with consequences, Locked and Deactivated, carry
 * glyphs that differ from each other so they are found while scanning a column.
 * A value outside the four the API accepts (row 18) is shown as it came.
 */

function LockGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
      <path d="M4.5 5.5V4a1.5 1.5 0 0 1 3 0v1.5" />
    </svg>
  );
}

function StruckCircleGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <circle cx="6" cy="6" r="4" />
      <path d="M3.2 8.8l5.6-5.6" />
    </svg>
  );
}

export function EntityStatus({ status }: { status: string }) {
  if (status === 'Active') return <span className="text-fg-primary">Active</span>;
  if (status === 'Pending') return <span className="text-fg-muted">Pending</span>;
  if (status === 'Locked' || status === 'Deactivated') {
    return (
      <span className="inline-flex items-center gap-app-1 text-fg-muted">
        {status === 'Locked' ? <LockGlyph /> : <StruckCircleGlyph />}
        {status}
      </span>
    );
  }
  return <span className="text-fg-secondary">{status}</span>;
}
