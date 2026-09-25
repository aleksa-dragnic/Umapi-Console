import { SignOutButton } from '@/features/auth';

/**
 * The placeholder at `/` until the directory arrives in PR 12. It carries the
 * sign-out control until the shell takes it over in PR 16.
 */
export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-app-4">
      <h1 className="text-fg-emphasis text-app-title">Umapi Console</h1>
      <SignOutButton />
    </main>
  );
}
