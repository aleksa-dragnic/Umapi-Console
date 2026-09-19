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

export interface DialogProps {
  open: boolean;
  title: string;
  /** Called by Escape and by the cancel control. */
  onClose: () => void;
  /** Focus starts on Cancel instead of on the first control. */
  destructive?: boolean | undefined;
  cancelLabel?: string | undefined;
  children: ReactNode;
}

export function Dialog({
  open,
  title,
  onClose,
  destructive = false,
  cancelLabel = 'Cancel',
  children,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement;
    const entry = destructive ? cancel.current : (focusableIn(panel.current)[0] ?? cancel.current);
    entry?.focus();

    return () => {
      const previous = returnTo.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open, destructive]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
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
    }
    else if (!event.shiftKey && document.activeElement === last) {
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
        {children}
        <div className="flex justify-end gap-app-2">
          <Button ref={cancel} onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}