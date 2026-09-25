import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import { setAccessToken } from '@/lib/api/access-token';
import { onRefresh, refreshAccessToken, sessionEndOf, type SessionEnd } from '@/lib/api/refresh';
import { requestSignOut, type AuthFailure, type AuthResult } from '@/features/auth/api';

/**
 * The session: whether anyone is signed in, and the access token if so. The
 * token lives in memory only (build plan section 4.5, ADR 0007) - in this
 * provider's state, and in `lib/api/access-token.ts`, which the client reads.
 *
 * A reload therefore starts with no token. The provider asks the API for one
 * with the refresh cookie before anything decides who the user is; that is the
 * `boot` screen (inventory section 3.1). After that, a 401 on any request is
 * met by a silent refresh in the client (inventory section 2.3); the provider
 * hears every refresh answer and ends the session on a 401 (section 2.4).
 */

export type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; accessToken: string }
  /**
   * `reason` says why a session that existed is gone: the API ended it (the
   * banner on sign-in says which way), or the user signed out. Absent, there
   * was none.
   */
  | { status: 'anonymous'; reason?: SessionEnd | 'signed-out' }
  /** The refresh shares the sign-in budget (observed row 52); a 429 is not a lost session. */
  | { status: 'rate-limited'; retryAfterSeconds: number }
  /** No answer, or one that says nothing about the session. */
  | { status: 'unavailable'; failure: AuthFailure };

/** What the boot refresh's answer means for the session. Every 401 means signed out. */
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

/**
 * What a refresh answer means for a session that is already running. A new
 * token replaces the old one; a 401 ends it, with the reason; anything else - a
 * 429, a 5xx, no answer - leaves it as it is, and the request that needed the
 * refresh shows that answer where it was made (inventory section 2.3).
 */
function sessionAfterRefresh(current: SessionState, result: AuthResult): SessionState {
  if (current.status !== 'authenticated') return current;
  if (result.kind === 'token') {
    return { status: 'authenticated', accessToken: result.accessToken };
  }
  const ended = sessionEndOf(result);
  return ended === null ? current : { status: 'anonymous', reason: ended };
}

export interface SessionValue {
  state: SessionState;
  /** Asks the API once whether a session exists. Repeated calls do nothing. */
  boot: () => void;
  /** Asks again, after `rate-limited` or `unavailable`. */
  retry: () => void;
  /** Holds the access token a sign-in returned. */
  signIn: (accessToken: string) => void;
  /** Tells the API, then forgets the session whatever it answered. */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'checking' });
  // Development renders twice under StrictMode, and two refreshes sent together
  // with one cookie are exactly the race of observed rows 11 and 46. The boot
  // refresh is therefore guarded, not merely deduplicated by timing, and it
  // goes through the same single-flight as every other refresh (ADR 0008).
  const booted = useRef(false);
  // A retry supersedes an answer still in flight.
  const generation = useRef(0);

  useEffect(
    () => onRefresh((result) => setState((current) => sessionAfterRefresh(current, result))),
    [],
  );

  function adopt(next: SessionState) {
    setAccessToken(next.status === 'authenticated' ? next.accessToken : null);
    setState(next);
  }

  function refresh() {
    generation.current += 1;
    const current = generation.current;
    void refreshAccessToken().then((result) => {
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
    signOut: async () => {
      await requestSignOut();
      adopt({ status: 'anonymous', reason: 'signed-out' });
    },
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
