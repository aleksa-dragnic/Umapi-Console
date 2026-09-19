import { useId, type InputHTMLAttributes } from 'react';

/**
 * A labelled field and the message the API blamed it for. The label is always
 * present: a placeholder is not a label, and it disappears exactly when the
 * user needs it.
 */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Field-level message, taken from the problem details errors object. */
  error?: string | undefined;
}

const FIELD = [
  'h-[var(--size-control)] w-full px-app-2 rounded-control border',
  'border-border-default bg-canvas',
  'font-sans text-app-body text-fg-primary placeholder:text-fg-disabled',
  'transition-colors duration-[var(--duration-hover)] ease-standard',
  'focus-visible:border-border-strong aria-invalid:border-border-danger',
].join(' ');

export function Input({ label, error, className, ...rest }: InputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = error !== undefined;

  return (
    <div className="flex flex-col gap-app-1">
      <label htmlFor={id} className="font-mono text-app-label uppercase text-fg-muted">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={[FIELD, className].filter(Boolean).join(' ')}
        aria-invalid={invalid ? true : undefined}
        {...(invalid ? { 'aria-describedby': errorId } : {})}
      />
      {invalid ? (
        <span id={errorId} className="font-mono text-app-meta text-fg-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}