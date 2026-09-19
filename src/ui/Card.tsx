import { useId, type ReactNode } from 'react';

/**
 * A panel on the canvas. Elevation is a border, not a shadow, and the padding
 * comes from the screen's declared density rather than from the component -
 * see DESIGN-DECISIONS sections 4, 6 and 11.
 */

export interface CardProps {
  /** Rendered as the panel's heading and used as its accessible name. */
  title?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}

const PANEL = 'rounded-card border border-border-default bg-canvas p-[var(--density-pad)]';

export function Card({ title, children, className }: CardProps) {
  const titleId = useId();
  const titled = title !== undefined;

  return (
    <section
      className={[PANEL, className].filter(Boolean).join(' ')}
      {...(titled ? { 'aria-labelledby': titleId } : {})}
    >
      {titled ? (
        <h2 id={titleId} className="text-app-subtitle text-fg-emphasis">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}