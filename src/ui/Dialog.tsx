import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

import { Button } from '@/ui/Button';

/**
 * A modal dialog with the focus contract from SCREEN-INVENTORY section 4:
 * focus enters on open, is trapped while open, Escape closes, and the control
 * that opened it regains focus on close.
 *
 * A destructive dialog starts on Cancel rather than on the destructive
 * control, so a reflexive Enter does not lock a user out of their account.
 *
 * The action row holds Cancel and, when the dialog has one, the action it
 * confirms: a ghost control, with the alarm border in a destructive dialog
 * (DESIGN-DECISIONS section 2). While the action is in flight the dialog
 * stays open and neither Cancel nor Escape closes it - the answer belongs to
 * the dialog that asked (inventory section 3.5, `submitting`).
 *
 * No library. The trap is a keydown handler over the panel's focusable
 * elements, which is the whole of what a library would do here.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (root === null) return [];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

export interface DialogAction {
  label: string;
  onConfirm: () => void;
  /** A request is in flight: the dialog holds, and the control is busy. */
  pending?: boolean | undefined;
  /** Why the action cannot be taken; present means disabled, with the reason shown. */
  disabledReason?: ReactNode | undefined;
}

export interface DialogProps {
  open: boolean;
  title: string;
  /** Called by Escape and by the cancel control. */
  onClose: () => void;
  /** Focus starts on Cancel instead of on the first control. */
  destructive?: boolean | undefined;
  cancelLabel?: string | undefined;
  /** The action the dialog confirms, beside Cancel. Absent leaves Cancel alone. */
  action?: DialogAction | undefined;
  children: ReactNode;
}

export function Dialog({
  open,
  title,
  onClose,
  destructive = false,
  cancelLabel = 'Cancel',
  action,
  children,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement;
    const entry = destructive
      ? cancel.current
      : (focusableIn(body.current)[0] ?? confirm.current ?? cancel.current);
    entry?.focus();

    return () => {
      const previous = returnTo.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open, destructive]);

  if (!open) return null;

  const holding = action?.pending === true;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!holding) onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = focusableIn(panel.current);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas p-app-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-md flex-col gap-[var(--density-gap)] rounded-panel border border-border-default bg-lift p-[var(--density-pad)]"
      >
        <h2 id={titleId} className="text-app-subtitle text-fg-emphasis">
          {title}
        </h2>
        <div ref={body} className="flex flex-col gap-[var(--density-gap)]">
          {children}
        </div>
        <div className="flex flex-wrap items-start justify-end gap-app-2">
          <Button ref={cancel} pending={holding} onClick={onClose}>
            {cancelLabel}
          </Button>
          {action === undefined ? null : (
            <Button
              ref={confirm}
              variant={destructive ? 'destructive' : 'ghost'}
              pending={holding}
              disabledReason={action.disabledReason}
              onClick={action.onConfirm}
            >
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
