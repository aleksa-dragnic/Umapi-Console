import { useState } from 'react';

import { useSession } from '@/features/auth/session';
import { Button } from '@/ui/Button';

/**
 * Signing out: the API is told, so it revokes the refresh token and clears the
 * cookie (observed row 54, section 3.2), and the session is then forgotten
 * whatever it answered. `RequireSession` takes the user to sign-in with no
 * `next` and the sign-in screen shows no banner - the user chose to leave, so
 * nothing ended and there is nowhere to return to.
 *
 * It sits in the shell's header, beside the account it signs out.
 */
export function SignOutButton() {
  const { signOut } = useSession();
  const [pending, setPending] = useState(false);

  function leave() {
    setPending(true);
    void signOut();
  }

  return (
    <Button pending={pending} onClick={leave}>
      Sign out
    </Button>
  );
}
