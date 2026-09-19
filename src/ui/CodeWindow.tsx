import type { ReactNode } from 'react';

/**
 * The terminal window the inspector renders a request or a response in. A card
 * radius, a hairline border, and the lift surface, because a code window is a
 * panel rather than part of the canvas - see DESIGN-DECISIONS sections 6 and 7.
 *
 * Truncation is stated rather than hidden. A body silently cut at 64 kB looks
 * like an API that returned less than it did.
 */

export interface CodeWindowProps {
  /** Rendered as the window's caption - a method and path, or a header name. */
  title?: string | undefined;
  /** The body, rendered verbatim. */
  children: ReactNode;
  /** When set, the body was cut at this many kilobytes and the fact is shown. */
  truncatedAtKb?: number | undefined;
  className?: string | undefined;
}

const FRAME = 'rounded-card border border-border-default bg-lift';
const STRIP = 'px-app-3 py-app-1 font-mono text-app-meta text-fg-muted';

export function CodeWindow({ title, children, truncatedAtKb, className }: CodeWindowProps) {
  return (
    <figure className={[FRAME, className].filter(Boolean).join(' ')}>
      {title !== undefined ? (
        <figcaption className={`${STRIP} border-b border-border-default`}>{title}</figcaption>
      ) : null}
      <pre className="overflow-x-auto px-app-3 py-app-2 font-mono text-app-meta text-fg-primary">
        <code>{children}</code>
      </pre>
      {truncatedAtKb !== undefined ? (
        <p className={`${STRIP} border-t border-border-default`}>
          Response truncated at {truncatedAtKb} kB.
        </p>
      ) : null}
    </figure>
  );
}