import { useSyncExternalStore } from 'react';

/**
 * The access token, held in memory and nowhere else (build plan section 4.5,
 * ADR 0007). The client reads it for every request. It is written by the
 * session provider when a user signs in or out, and by the refresh in
 * `lib/api/refresh.ts`, which replaces it and clears it the moment the API
 * ends the session. A reload loses it on purpose: the boot screen then asks
 * the API for a new one with the refresh cookie, which JavaScript cannot read
 * at all.
 *
 * With the token it keeps the moment the token arrived, on the monotonic clock
 * (`performance.now()`), because expiry is counted from arrival and never from
 * the client's wall clock (observed row 40). It is observable, so anything that
 * renders from the token - permissions, the expiry countdown - follows it
 * without going through the session provider (ADR 0009).
 */

export interface HeldAccessToken {
  readonly value: string;
  /** `performance.now()` when the token was first held. */
  readonly arrivedAt: number;
}

let held: HeldAccessToken | null = null;
const listeners = new Set<() => void>();

/**
 * Holds a token, or none. Holding the token already held changes nothing, so
 * its arrival is the first time it was set, not the latest.
 */
export function setAccessToken(token: string | null): void {
  if (token === (held?.value ?? null)) return;
  held = token === null ? null : { value: token, arrivedAt: performance.now() };
  listeners.forEach((listener) => listener());
}

export function currentAccessToken(): string | null {
  return held?.value ?? null;
}

export function heldAccessToken(): HeldAccessToken | null {
  return held;
}

/** Called whenever the token held changes. Returns the function that stops it. */
export function subscribeAccessToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The token held, re-rendering whenever it changes. */
export function useAccessToken(): HeldAccessToken | null {
  return useSyncExternalStore(subscribeAccessToken, heldAccessToken);
}
