import { Suspense, lazy, useState } from 'react';

import { SIGN_IN_PATH } from '@/features/auth';
import { USERS_PATH } from '@/features/users';
import { hadSession } from '@/lib/api/session-hint';

/**
 * `/`, the public landing page (inventory section 3.14, ADR 0018). It sits
 * outside the session boundary, so it renders at once and sends nothing to the
 * API. What it offers depends on whether this browser had a session (ADR 0017):
 * the console for one that did, the demo for one that did not. A hint that has
 * gone stale costs one detour: the directory finds no session and asks for
 * sign-in. The page is its own chunk, loaded only here.
 */

const LandingPage = lazy(() =>
  import('@/features/landing').then((module) => ({ default: module.LandingPage })),
);

export const OPEN_CONSOLE = 'Open console';
export const TRY_DEMO = 'Try the demo';

export function LandingRoute() {
  const [returning] = useState(hadSession);
  const action = returning
    ? { label: OPEN_CONSOLE, to: USERS_PATH }
    : { label: TRY_DEMO, to: SIGN_IN_PATH };

  return (
    <Suspense fallback={null}>
      <LandingPage action={action} />
    </Suspense>
  );
}
