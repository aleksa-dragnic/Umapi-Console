import {
  REFRESH_TOKEN_REUSED,
  adoptRefresh,
  requestRefresh,
  sessionEndOf,
  type AuthResult,
} from '@/lib/api/refresh';

/**
 * The reuse demonstration (inventory section 3.9, build plan section 6.1): two
 * refreshes sent at the same moment with the same cookie - the mistake
 * single-flight exists to prevent (ADR 0008), made on purpose. The API lets one
 * through and refuses the other, and which refusal depends on timing (observed
 * rows 11 and 46):
 *
 * - `raced`: 409 `Concurrency.Conflict`. The loser collided with the winner's
 *   write; nothing is revoked and the winner's token stands.
 * - `revoked`: 401 `Auth.RefreshTokenReused`. The loser read the rotated token,
 *   which is indistinguishable from a stolen one; every session of the account
 *   is revoked.
 * - `unexpected`: any other pair, stated as it arrived. Two 200s would be an API
 *   defect.
 */

export const CONCURRENCY_CONFLICT = 'Concurrency.Conflict';

export type RacePair = readonly [AuthResult, AuthResult];

export type RaceOutcome =
  | { kind: 'raced'; pair: RacePair }
  | { kind: 'revoked'; pair: RacePair }
  | { kind: 'unexpected'; pair: RacePair };

function refusedWith(result: AuthResult, status: number, errorCode: string): boolean {
  return (
    result.kind === 'refused' &&
    result.problem.status === status &&
    result.problem.errorCode === errorCode
  );
}

export function classifyRace(pair: RacePair): RaceOutcome {
  const tokens = pair.filter((result) => result.kind === 'token').length;
  if (tokens === 1 && pair.some((result) => refusedWith(result, 409, CONCURRENCY_CONFLICT))) {
    return { kind: 'raced', pair };
  }
  if (tokens === 1 && pair.some((result) => refusedWith(result, 401, REFRESH_TOKEN_REUSED))) {
    return { kind: 'revoked', pair };
  }
  return { kind: 'unexpected', pair };
}

/**
 * The one answer of the pair that decides the session. A 401 that ends it wins
 * over a new token: the two can arrive in either order, and adopting them one
 * by one would let a 200 that lands after the reuse restore a session the API
 * has just revoked. Otherwise a new token is adopted; otherwise nothing.
 */
export function decisiveAnswer(pair: RacePair): AuthResult | null {
  return (
    pair.find((result) => sessionEndOf(result) !== null) ??
    pair.find((result) => result.kind === 'token') ??
    null
  );
}

/** Sends both refreshes, then adopts the decisive answer through `adoptRefresh`. */
export async function raceRefreshes(): Promise<RaceOutcome> {
  const pair = await Promise.all([requestRefresh(), requestRefresh()]);
  const decisive = decisiveAnswer(pair);
  if (decisive !== null) adoptRefresh(decisive);
  return classifyRace(pair);
}
