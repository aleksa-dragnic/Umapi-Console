import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';

import { Button } from '@/ui/Button';

/**
 * A modal dialog with the focus contract from SCREEN-INVENTORY section 4:
 * focus enters on open, stays inside while open, Escape closes, and the control
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
 * The native <dialog>, opened with showModal() (#61). The platform puts it in
 * the top layer and makes the page behind it inert - unreachable by Tab, by
 * pointer and by a screen reader's virtual cursor, which the keydown trap this
 * replaced could not do - and turns Escape into a `cancel` event. The component
 * keeps the parts that are the inventory's rather than the platform's: where
 * focus starts, that it returns to the opener, and that nothing closes the
 * dialog while its action is in flight.
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
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);
  const closing = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!open || element === null) return;

    returnTo.current = document.activeElement;
    if (!element.open) element.showModal();

    // showModal() focuses the first control by itself; the inventory decides
    // instead, and a destructive dialog starts on Cancel.
    const entry = destructive
      ? cancel.current
      : (focusableIn(body.current)[0] ?? confirm.current ?? cancel.current);
    entry?.focus();

    return () => {
      closing.current = true;
      if (element.open) element.close();
      closing.current = false;

      const previous = returnTo.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open, destructive]);

  if (!open) return null;

  const holding = action?.pending === true;

  // Escape. Always prevented: the open state is React's, and onClose asks for
  // it to change - unless the action is in flight, when the dialog holds.
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault();
    if (!holding) onClose();
  };

  // Chrome closes a dialog without honouring preventDefault() after repeated
  // Escapes with no other user activation in between. If the platform closed
  // it while it should still be open, it opens again: the contract above holds.
  const onNativeClose = (): void => {
    const element = dialog.current;
    if (closing.current || element === null || element.open) return;
    element.showModal();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Implied by showModal(), and stated so the inspector's Escape handler
      // can tell an open dialog is above it with one selector for both kinds.
      aria-modal="true"
      onCancel={onCancel}
      onClose={onNativeClose}
      className="m-auto w-[calc(100%-2*var(--spacing-app-4))] max-w-md flex-col gap-[var(--density-gap)] rounded-panel border border-border-default bg-lift p-[var(--density-pad)] text-fg-primary open:flex backdrop:bg-canvas"
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
    </dialog>
  );
}
