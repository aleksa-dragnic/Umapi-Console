import { useId, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';

/**
 * Every action in this application. There is no filled primary button: the
 * accent belongs to identifiers, not to controls - see DESIGN-DECISIONS
 * section 2.
 *
 * An action the token does not permit is rendered disabled with its reason
 * stated, never hidden. A hidden control teaches a reviewer nothing; a
 * disabled one with a reason shows the whole permission model at a glance.
 */

export type ButtonVariant = 'ghost' | 'destructive';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'aria-disabled'> {
  /** React 19 passes ref as an ordinary prop. Dialog uses it to place focus. */
  ref?: Ref<HTMLButtonElement> | undefined;
  variant?: ButtonVariant | undefined;
  /** Why this action is unavailable. Present means disabled, with the reason shown. */
  disabledReason?: string | undefined;
  /** A request is in flight. The control is busy and refuses a second activation. */
  pending?: boolean | undefined;
  children: ReactNode;
}

const BASE = [
  'inline-flex items-center justify-center gap-app-1',
  'h-[var(--size-control)] px-app-3 rounded-control border',
  'font-sans text-app-body',
  'transition-colors duration-[var(--duration-hover)] ease-standard',
  'aria-disabled:cursor-not-allowed aria-disabled:text-fg-disabled',
  'aria-disabled:border-border-default',
].join(' ');

const VARIANT: Record<ButtonVariant, string> = {
  ghost: 'border-border-default text-fg-emphasis hover:border-border-strong',
  destructive: 'border-border-danger text-fg-danger',
};

export function Button({
  ref,
  variant = 'ghost',
  disabledReason,
  pending = false,
  children,
  className,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const reasonId = useId();
  const gated = disabledReason !== undefined;
  const inert = gated || pending;

  const control = (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={[BASE, VARIANT[variant], className].filter(Boolean).join(' ')}
      aria-disabled={inert ? true : undefined}
      aria-busy={pending ? true : undefined}
      {...(gated ? { 'aria-describedby': reasonId } : {})}
      onClick={(event) => {
        // aria-disabled rather than disabled: a disabled control is removed
        // from the tab order, and a reason nobody can reach is not a reason.
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );

  if (!gated) {
    return control;
  }

  return (
    <span className="inline-flex flex-col items-start gap-app-1">
      {control}
      <span id={reasonId} className="font-mono text-app-meta text-fg-muted">
        {disabledReason}
      </span>
    </span>
  );
}