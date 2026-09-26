import { Link } from 'react-router';

import { SESSION_PATH, SignOutButton } from '@/features/auth';

/**
 * The placeholder at `/` until the directory arrives in PR 12. It carries the
 * sign-out control and the way to the session screen until the shell takes
 * both over in PR 16.
 */
export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-app-4">
      <h1 className="text-fg-emphasis text-app-title">Umapi Console</h1>
      <Link
        to={SESSION_PATH}
        className="text-app-body text-fg-secondary underline underline-offset-4 transition-colors duration-[var(--duration-hover)] ease-standard hover:text-fg-primary"
      >
        Session
      </Link>
      <SignOutButton />
    </main>
  );
}
