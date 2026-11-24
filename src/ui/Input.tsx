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
  /** What the field expects, shown under it before anything goes wrong. */
  hint?: string | undefined;
}

const FIELD = [
  'h-[var(--size-control)] w-full px-app-2 rounded-control border',
  'border-border-default bg-canvas',
  'font-sans text-app-body text-fg-primary placeholder:text-fg-disabled',
  'transition-colors duration-[var(--duration-hover)] ease-standard',
  'focus-visible:border-border-strong aria-invalid:border-border-danger',
].join(' ');

export function Input({ label, error, hint, className, ...rest }: InputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = error !== undefined;
  // The hint stays while the error is shown: the error says what went wrong,
  // the hint what is expected. A screen reader hears both, error first.
  const describedBy = [invalid ? errorId : null, hint === undefined ? null : hintId]
    .filter((part) => part !== null)
    .join(' ');

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
        {...(describedBy === '' ? {} : { 'aria-describedby': describedBy })}
      />
      {hint === undefined ? null : (
        <span id={hintId} className="font-mono text-app-meta text-fg-secondary">
          {hint}
        </span>
      )}
      {invalid ? (
        <span id={errorId} className="font-mono text-app-meta text-fg-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
