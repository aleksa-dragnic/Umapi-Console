import { Link } from 'react-router';

import { SESSION_PATH, SignOutButton } from '@/features/auth';
import { USERS_PATH } from '@/features/users';

/**
 * The placeholder at `/`. It carries the way to the directory and to the
 * session screen, and the sign-out control, until the shell takes them over in
 * PR 16; whether `/` then becomes a landing page or a redirect to `/users` is
 * open decision 1.
 */
const LINK =
  'text-app-body text-fg-secondary underline underline-offset-4 transition-colors duration-[var(--duration-hover)] ease-standard hover:text-fg-primary';

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-app-4">
      <h1 className="text-fg-emphasis text-app-title">Umapi Console</h1>
      <nav aria-label="Console" className="flex gap-app-4">
        <Link to={USERS_PATH} className={LINK}>
          Users
        </Link>
        <Link to={SESSION_PATH} className={LINK}>
          Session
        </Link>
      </nav>
      <SignOutButton />
    </main>
  );
}
