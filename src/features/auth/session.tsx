import { createContext, use, useRef, useState, type ReactNode } from 'react';

import { setAccessToken } from '@/lib/api/access-token';
import { requestRefresh, type AuthFailure, type AuthResult } from '@/features/auth/api';

/**
 * The session: whether anyone is signed in, and the access token if so. The
 * token lives in memory only (build plan section 4.5, ADR 0007) - in this
 * provider's state, and in `lib/api/access-token.ts`, which the client reads.
 * Both are written together, here and nowhere else.
 *
 * A reload therefore starts with no token. The provider asks the API for one
 * with the refresh cookie before anything decides who the user is; that is the
 * `boot` screen (inventory section 3.1).
 */

export type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; accessToken: string }
  | { status: 'anonymous' }
  /** The refresh shares the sign-in budget (observed row 52); a 429 is not a lost session. */
  | { status: 'rate-limited'; retryAfterSeconds: number }
  /** No answer, or one that says nothing about the session. */
  | { status: 'unavailable'; failure: AuthFailure };

/** What a refresh answer means for the session. Every 401 means signed out. */
export function stateAfterRefresh(result: AuthResult): SessionState {
  if (result.kind === 'token') {
    return { status: 'authenticated', accessToken: result.accessToken };
  }
  if (result.kind === 'refused' && result.problem.status === 401) {
    return { status: 'anonymous' };
  }
  if (result.kind === 'refused' && result.problem.status === 429) {
    return { status: 'rate-limited', retryAfterSeconds: result.retryAfterSeconds };
  }
  return { status: 'unavailable', failure: result };
}

export interface SessionValue {
  state: SessionState;
  /** Asks the API once whether a session exists. Repeated calls do nothing. */
  boot: () => void;
  /** Asks again, after `rate-limited` or `unavailable`. */
  retry: () => void;
  /** Holds the access token a sign-in returned. */
  signIn: (accessToken: string) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'checking' });
  // Development renders twice under StrictMode, and two refreshes sent together
  // with one cookie are exactly the race of observed rows 11 and 46. The boot
  // refresh is therefore guarded, not merely deduplicated by timing.
  const booted = useRef(false);
  // A retry supersedes an answer still in flight.
  const generation = useRef(0);

  function adopt(next: SessionState) {
    setAccessToken(next.status === 'authenticated' ? next.accessToken : null);
    setState(next);
  }

  function refresh() {
    generation.current += 1;
    const current = generation.current;
    void requestRefresh().then((result) => {
      if (current === generation.current) {
        adopt(stateAfterRefresh(result));
      }
    });
  }

  const value: SessionValue = {
    state,
    boot: () => {
      if (booted.current) return;
      booted.current = true;
      refresh();
    },
    retry: () => {
      setState({ status: 'checking' });
      refresh();
    },
    signIn: (accessToken) => adopt({ status: 'authenticated', accessToken }),
  };

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (value === null) {
    throw new Error('useSession is used outside a SessionProvider.');
  }
  return value;
}
