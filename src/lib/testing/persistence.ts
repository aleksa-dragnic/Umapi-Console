import { db, type MockRefreshToken, type RefreshTokenState } from '@/lib/testing/db';

/**
 * The mock's refresh tokens, kept across a reload in the browser.
 *
 * In a browser the mock's database lives in the page, and MSW keeps its cookie
 * jar in `localStorage`. A reload used to keep the cookie and lose the token it
 * names, so the refresh was refused and a signed-in developer landed on sign-in
 * - the mock behaving unlike the API, whose tokens outlive any page. The table
 * is therefore written to `sessionStorage` after every mocked response and read
 * back before the worker starts.
 *
 * Only the tokens are kept. Users and roles are rebuilt from the same seed on
 * every load, so a token's user id still names the same user; changes made to
 * users in the dev server are lost on reload, as before. `sessionStorage`
 * rather than `localStorage`: a new tab starts with an empty table, so it meets
 * the cookie as an unknown token and signs in afresh, while a reload keeps the
 * session.
 *
 * This is the one file in `src/` allowed to touch browser storage outside a
 * test (`eslint.config.js`). It is mock code, never in a production bundle.
 * Only `browser.ts` calls it; under Vitest the mock is reset between tests and
 * nothing is kept.
 */

export const STORAGE_KEY = 'umapi-mock-refresh-tokens';

type StoredToken = Omit<MockRefreshToken, 'rotation'>;

const STATES: readonly RefreshTokenState[] = ['active', 'rotating', 'rotated', 'revoked'];

function isStoredToken(value: unknown): value is StoredToken {
  if (typeof value !== 'object' || value === null) return false;
  const token = value as Record<string, unknown>;
  return (
    typeof token['value'] === 'string' &&
    typeof token['userId'] === 'string' &&
    typeof token['expiresAtMs'] === 'number' &&
    STATES.some((state) => state === token['state'])
  );
}

export function saveRefreshTokens(storage: Storage = sessionStorage): void {
  const tokens: StoredToken[] = [...db().refreshTokens.values()].map(
    ({ value, userId, expiresAtMs, state }) => ({ value, userId, expiresAtMs, state }),
  );
  storage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * Puts the saved tokens back. A token saved mid-rotation comes back `active`:
 * the page that was writing the rotation is gone and its answer never reached
 * the browser, so the rotation was never committed. Anything unreadable is
 * dropped whole and the table starts empty, which is a reload into sign-in -
 * the state before this file existed.
 */
export function restoreRefreshTokens(storage: Storage = sessionStorage): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return;
  }
  if (!Array.isArray(parsed) || !parsed.every(isStoredToken)) return;
  for (const token of parsed) {
    const state = token.state === 'rotating' ? 'active' : token.state;
    db().refreshTokens.set(token.value, { ...token, state });
  }
}
