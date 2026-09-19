import type { ReactNode } from 'react';

/**
 * A mono data label: a permission name, a role, an API version. Hairline
 * border and ash gray text, never a colour per value - a palette that has to
 * grow when a role is added is not a palette. See DESIGN-DECISIONS section 10.
 */

export interface BadgeProps {
  children: ReactNode;
  className?: string | undefined;
}

const LABEL = [
  'inline-flex items-center px-app-1 py-0.5',
  'rounded-control border border-border-default',
  'font-mono text-app-meta text-fg-muted',
].join(' ');

export function Badge({ children, className }: BadgeProps) {
  return <span className={[LABEL, className].filter(Boolean).join(' ')}>{children}</span>;
}