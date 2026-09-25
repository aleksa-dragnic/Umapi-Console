import { Navigate, Outlet, useLocation } from 'react-router';

import { signInPathFor } from '@/features/auth/next';
import { useSession } from '@/features/auth/session';

/**
 * The routes that need a signed-in user. Anyone else goes to sign-in, with the
 * address they asked for kept as `next` (inventory sections 3.1 and 5).
 * Permission guards on top of this arrive in PR 11.
 */
export function RequireSession() {
  const { state } = useSession();
  const location = useLocation();

  if (state.status !== 'authenticated') {
    return (
      <Navigate to={signInPathFor(location.pathname + location.search + location.hash)} replace />
    );
  }
  return <Outlet />;
}
