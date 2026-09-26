import { useId, type SelectHTMLAttributes } from 'react';

/**
 * A labelled choice among a few fixed values - the directory's status filter.
 * Built like `Input`: the label is always present and sits above the control,
 * and the control is the native `<select>`, so the keyboard and the platform's
 * picker behave as the user expects without anything re-implemented.
 */

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'children'
> {
  label: string;
  options: readonly SelectOption[];
}

const FIELD = [
  'h-[var(--size-control)] w-full px-app-2 rounded-control border',
  'border-border-default bg-canvas',
  'font-sans text-app-body text-fg-primary',
  'transition-colors duration-[var(--duration-hover)] ease-standard',
  'focus-visible:border-border-strong',
].join(' ');

export function Select({ label, options, className, ...rest }: SelectProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-app-1">
      <label htmlFor={id} className="font-mono text-app-label uppercase text-fg-muted">
        {label}
      </label>
      <select {...rest} id={id} className={[FIELD, className].filter(Boolean).join(' ')}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
