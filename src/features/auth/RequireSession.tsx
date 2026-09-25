import { Navigate, Outlet, useLocation } from 'react-router';

import { SIGN_IN_PATH, signInPathFor } from '@/features/auth/next';
import { useSession } from '@/features/auth/session';

/**
 * The routes that need a signed-in user. Anyone else goes to sign-in, with the
 * address they asked for kept as `next` (inventory sections 2.4, 3.1 and 5) -
 * except a user who has just signed out, who chose to leave and has nowhere
 * to return to. Permission guards on top of this arrive in PR 11.
 */
export function RequireSession() {
  const { state } = useSession();
  const location = useLocation();

  if (state.status !== 'authenticated') {
    const signedOut = state.status === 'anonymous' && state.reason === 'signed-out';
    const to = signedOut
      ? SIGN_IN_PATH
      : signInPathFor(location.pathname + location.search + location.hash);
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}
