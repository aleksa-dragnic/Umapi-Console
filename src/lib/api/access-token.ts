/**
 * The access token, held in memory and nowhere else (build plan section 4.5,
 * ADR 0007). The client reads it for every request. It is written by the
 * session provider when a user signs in or out, and by the refresh in
 * `lib/api/refresh.ts`, which replaces it and clears it the moment the API
 * ends the session. A reload loses it on purpose: the boot screen then asks
 * the API for a new one with the refresh cookie, which JavaScript cannot read
 * at all.
 */

let current: string | null = null;

export function setAccessToken(token: string | null): void {
  current = token;
}

export function currentAccessToken(): string | null {
  return current;
}
