import { Link, useLocation } from 'react-router';

import { SIGN_IN_PATH } from '@/features/auth';
import { USERS_PATH } from '@/features/users';
import { useAccessToken } from '@/lib/api/access-token';

/**
 * The `404` screen (inventory section 3.10), in editorial density: the path
 * that was not found, and the way on that fits the session - the directory for
 * a signed-in user, sign-in for anyone else. It sits inside the session
 * boundary, so the boot refresh has already said which one applies.
 */

export const NOT_FOUND_HEADING = 'Nothing here';

const LINK =
  'text-editorial-md text-fg-secondary underline underline-offset-4 transition-colors duration-[var(--duration-hover)] ease-standard hover:text-fg-primary';

export function NotFound() {
  const { pathname } = useLocation();
  const signedIn = useAccessToken() !== null;

  return (
    <main
      data-density="editorial"
      className="flex min-h-screen items-center justify-center p-[var(--density-pad)] text-[length:var(--density-body)]"
    >
      <div className="flex w-full max-w-md flex-col gap-app-3">
        <h1 tabIndex={-1} className="font-display text-display-sm text-fg-emphasis">
          {NOT_FOUND_HEADING}
        </h1>
        <p className="text-editorial-md text-fg-secondary">
          No screen lives at{' '}
          <code className="font-mono text-app-body break-all text-fg-identifier">{pathname}</code>.
        </p>
        {signedIn ? (
          <Link to={USERS_PATH} className={LINK}>
            Go to the directory
          </Link>
        ) : (
          <Link to={SIGN_IN_PATH} className={LINK}>
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}
