/**
 * How long the access token has left, counted without the client's wall clock
 * (build plan section 4.5). The development machine ran two minutes ahead of the
 * server (observed row 40), so `exp` is never compared with `Date.now()`. The
 * token's lifetime is `exp - iat`, both from the server's clock, and the time
 * spent is measured on the monotonic clock from the moment the token arrived.
 */

/** Whole seconds left, rounded up, and never below zero. */
export function remainingSeconds(lifetimeSeconds: number, arrivedAt: number, now: number): number {
  return Math.max(0, Math.ceil((lifetimeSeconds * 1000 - (now - arrivedAt)) / 1000));
}

/** `m:ss`, as the session screen shows it. */
export function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
