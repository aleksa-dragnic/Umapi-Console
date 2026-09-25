/**
 * The app mark: the one chromatic surface in the application (DESIGN-DECISIONS
 * section 7). Its gradient runs between the two mark tokens and nowhere else.
 * The glyph is a prompt, for a console that shows its HTTP.
 */

export type AppMarkSize = 'md' | 'lg';

export interface AppMarkProps {
  size?: AppMarkSize | undefined;
  className?: string | undefined;
}

const FRAME: Record<AppMarkSize, string> = {
  md: 'size-10 rounded-control',
  lg: 'size-16 rounded-card',
};

const GLYPH: Record<AppMarkSize, string> = {
  md: 'size-5',
  lg: 'size-8',
};

export function AppMark({ size = 'md', className }: AppMarkProps) {
  return (
    <span
      role="img"
      aria-label="Umapi Console"
      className={[
        'inline-flex shrink-0 items-center justify-center text-fg-emphasis',
        'bg-linear-to-br from-mark-from to-mark-to',
        FRAME[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={GLYPH[size]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 4.5 7 8l-4 3.5" />
        <path d="M8.5 12H13" />
      </svg>
    </span>
  );
}
