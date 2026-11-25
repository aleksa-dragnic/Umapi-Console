import { MARK_PATHS, MARK_VIEWBOX } from '@/ui/mark';

/**
 * The app mark: the one chromatic surface in the application (DESIGN-DECISIONS
 * section 7). Its gradient runs between the two mark tokens and nowhere else.
 * The glyph is a U whose right stem returns as an arrow: a request goes in, a
 * response comes back (`mark.ts`, DESIGN-DECISIONS section 12).
 */

export type AppMarkSize = 'sm' | 'md' | 'lg';

export interface AppMarkProps {
  size?: AppMarkSize | undefined;
  className?: string | undefined;
}

const FRAME: Record<AppMarkSize, string> = {
  sm: 'size-7 rounded-control',
  md: 'size-10 rounded-control',
  lg: 'size-16 rounded-card',
};

const GLYPH: Record<AppMarkSize, string> = {
  sm: 'size-4',
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
        viewBox={MARK_VIEWBOX}
        className={GLYPH[size]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
