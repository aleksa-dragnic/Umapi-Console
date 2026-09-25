# 0007 - The refresh token lives in an HttpOnly cookie, and the access token in memory only

- **Status:** Accepted
- **Date:** 2026-09-25
- **PR:** #9

## Context

The deployed API returns both tokens in the login body today: `accessToken`,
`accessTokenExpiresAtUtc`, `refreshToken` and `refreshTokenExpiresAtUtc`
(`docs/OBSERVED-BEHAVIOUR.md` row 1), and takes the refresh token back in the
request body (row 6). A console that keeps what it is given has to put the
refresh token somewhere JavaScript can read, and a refresh token is a
seven-day credential (row 3).

Anything JavaScript can read, an injected script can read. The access token is
short-lived - fifteen minutes (row 2) - and is not checked against revocation
(row 9), so its exposure is bounded by `exp`. The refresh token's is not: it
mints new access tokens for a week, and replaying a stolen one revokes every
session of the account (rows 7-8) only after the thief has used it.

A reload, meanwhile, must not sign anyone out. Whatever keeps the session
across a reload has to survive it without being readable by the page.

## Decision

The contract is build plan section 3.2, reproduced verbatim in the bridge
specification. In the console that means:

- The refresh token is never seen by JavaScript. It travels only in the
  `umapi_rt` cookie - `HttpOnly`, `Secure`, host-only, `SameSite=Strict`,
  `Path=/api/v1/auth`, `Max-Age` equal to its remaining lifetime - which the
  API sets on login and refresh and clears on logout and on reuse.
- The access token is held in memory only: in the session provider
  (`src/features/auth/session.tsx`) and in `src/lib/api/access-token.ts`, which
  the client reads to send `Authorization`. Both are written in one place.
- Every call carries `credentials: 'include'` (`src/lib/api/client.ts`), so the
  cookie reaches the three auth endpoints and no others.
- On mount, before any route decides who the user is, the console calls
  `POST /auth/refresh` with no body. A 200 is a session; a 401 is none; a 429 is
  a wait, because refresh shares the sign-in budget (row 52); anything else is
  shown, with a retry. That is the `boot` screen of the inventory, section 3.1.
- The three auth calls are typed from section 3.2 in
  `src/lib/api/auth-contract.ts`, not from the generated schema, which still
  describes today's body. M5 regenerates the schema from the changed API and
  deletes that file.

## Alternatives considered

### The refresh token in `localStorage`

Survives a reload with no server change. Rejected because it puts a week-long
credential where any script on the origin can read it, which is the one
exposure this design exists to remove.

### Both tokens in memory only

Nothing is stored anywhere. Rejected because every reload, every new tab and
every return to the site would be a sign-in, and the boot screen's requirement -
a signed-in user reloading a deep route never sees the sign-in form - could
not be met at all.

### `sessionStorage`

Scoped to one tab and cleared when it closes. Rejected for the same reason as
`localStorage`: readable by script for as long as the tab lives, and a new tab
would still mean a new sign-in.

### A server-side session behind the console

A backend for the frontend would hold both tokens and give the browser a
session cookie of its own. Rejected by ADR 0001: the console is a static SPA on
a free host, and a second server exists only to move a problem the API can
solve with one cookie.

## Consequences

The console and the API must share a registrable domain, or `SameSite=Strict`
keeps the cookie from ever being sent (build plan section 3.3). That is a hard
requirement of M5, and until then the mock implements the contract
(`src/lib/testing/handlers/auth.ts`).

Until M5 the console and the deployed API disagree on purpose: the deployed
API still sends the refresh token in the body, and the console ignores it.

Enforced by `eslint.config.js`, which forbids `localStorage` and
`sessionStorage` anywhere in `src/` outside tests, and by
`src/features/auth/SignInScreen.test.tsx`, which signs in, proves the client
sends the token from memory, and asserts that no storage entry contains it.
The mock keeps its own cookie jar in `localStorage`, so the test asserts the
token's absence rather than empty storage.

The boot refresh runs once per page load and is guarded against a second run:
development renders effects twice, and two refreshes sent together with one
cookie are the race of rows 11 and 46. `src/features/auth/SessionBoundary.test.tsx`
asserts one refresh under `StrictMode`. Refreshing on a 401 mid-session, with
concurrent requests queued behind one refresh, is ADR 0008.
