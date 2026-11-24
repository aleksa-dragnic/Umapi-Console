/**
 * Whether this browser had a session the last time the console knew (ADR
 * 0017). One boolean under one key: never the access token, never anything an
 * injected script could use - the refresh cookie stays HttpOnly (ADR 0007).
 *
 * Without the hint, a visitor is shown sign-in at once instead of the boot
 * screen, and the session check runs behind it. With it, the console waits for
 * the check as before, so a user who is signed in never sees sign-in flash.
 *
 * The one production file allowed to touch storage (eslint.config.js). Storage
 * that throws - a private window, blocked site data - reads as "no hint".
 */

const KEY = 'umapi.session';

export function hadSession(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberSession(present: boolean): void {
  try {
    if (present) {
      window.localStorage.setItem(KEY, '1');
    } else {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    // Without storage the console checks before it renders, as it always did.
  }
}
