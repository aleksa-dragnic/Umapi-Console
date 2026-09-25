import { useEffect } from 'react';
import { Outlet } from 'react-router';

import { BootScreen } from '@/features/auth/BootScreen';
import { SessionProvider, useSession } from '@/features/auth/session';

/**
 * The layout route every session-aware route sits under. It holds the session
 * provider, boots it once, and renders the boot screen until the API has said
 * whether a session exists - so no route below it ever renders on a guess.
 */
export function SessionBoundary() {
  return (
    <SessionProvider>
      <SessionGate />
    </SessionProvider>
  );
}

function SessionGate() {
  const { state, boot, retry } = useSession();

  useEffect(() => {
    boot();
  }, [boot]);

  if (state.status === 'authenticated' || state.status === 'anonymous') {
    return <Outlet />;
  }
  return <BootScreen state={state} onRetry={retry} />;
}
