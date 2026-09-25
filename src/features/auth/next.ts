/**
 * The `next` parameter of the sign-in route (screen inventory section 5): where
 * to go once signed in. It arrives in the address bar, so it is treated as
 * untrusted - only a path inside this application is honoured, anything else
 * falls back to the default rather than erroring.
 */

export const SIGN_IN_PATH = '/sign-in';
const DEFAULT_DESTINATION = '/';

/** The sign-in URL that returns to `path`. The default is not written. */
export function signInPathFor(path: string): string {
  const destination = safeDestination(path);
  if (destination === DEFAULT_DESTINATION) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(destination)}`;
}

/**
 * `next` if it is a path on this origin, `/` otherwise. Rejected: anything not
 * starting with one slash (`https://…`, `//host`, `/\host`, which browsers
 * treat as another origin), and the sign-in route itself, which would loop.
 */
export function safeDestination(next: string | null | undefined): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return DEFAULT_DESTINATION;
  if (next.startsWith('//') || next.startsWith('/\\')) return DEFAULT_DESTINATION;
  const path = next.split(/[?#]/)[0] ?? '';
  if (path === SIGN_IN_PATH || path.startsWith(`${SIGN_IN_PATH}/`)) return DEFAULT_DESTINATION;
  return next;
}
