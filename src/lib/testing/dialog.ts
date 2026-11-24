/**
 * jsdom has HTMLDialogElement but neither showModal() nor close() (jsdom 30).
 * This is a stand-in for the unit tests, not a polyfill for any browser: it
 * toggles `open`, keeps the stack of modal dialogs, and turns Escape into the
 * cancelable `cancel` event a browser sends, closing the dialog when no
 * handler prevents it, then sending `close`.
 *
 * What it does not emulate: the top layer and the inert page behind a modal.
 * Those are the platform's, and e2e proves them in Chromium, Firefox and
 * WebKit (e2e/a11y.spec.ts).
 */
export function installDialogStandIn(): void {
  const prototype = HTMLDialogElement.prototype;
  if (typeof prototype.showModal === 'function') return;

  const modal: HTMLDialogElement[] = [];

  prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };

  prototype.showModal = function showModal(this: HTMLDialogElement) {
    if (this.hasAttribute('open')) {
      throw new DOMException('The dialog is already open.', 'InvalidStateError');
    }
    this.setAttribute('open', '');
    modal.push(this);
  };

  prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    const index = modal.indexOf(this);
    if (index >= 0) modal.splice(index, 1);
    this.dispatchEvent(new Event('close'));
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const top = modal.filter((dialog) => dialog.isConnected).at(-1);
    if (top === undefined) return;
    if (top.dispatchEvent(new Event('cancel', { cancelable: true }))) top.close();
  });
}
