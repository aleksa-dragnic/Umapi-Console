# 0008 - A 401 is met by one refresh in flight at a time, shared by every request that needs it

- **Status:** Accepted
- **Date:** 2026-09-25
- **PR:** #10

## Context

The access token lives fifteen minutes (`docs/OBSERVED-BEHAVIOUR.md` row 2) and
in memory only (ADR 0007), so a console left open meets 401s as a matter of
course, and a screen that loads several resources meets several at once. Each
one can be answered by a refresh with the cookie.

Two refreshes sent together with one cookie are not two successes. The API lets
one through and refuses the other: with a 409 and nothing revoked, or with a 401
`Auth.RefreshTokenReused` that revokes every session of the account (rows 8, 11,
46). The second outcome is indistinguishable from a stolen token, and it signs
out every visitor on the shared demo account. A console that refreshes once per
failed request would provoke it on any screen with two queries.

Refresh also shares the IP-keyed `auth` budget of ten a minute with sign-in and
sign-out (row 52), so every refresh the console sends without need is one fewer
sign-in attempt.

## Decision

Every refresh the console makes goes through `refreshAccessToken` in
`src/lib/api/refresh.ts`, which keeps at most one request in flight: a call made
while one is out receives that one's answer. The boot refresh uses it too.

The application client's middleware answers a 401 on a request that carried a
token by waiting for that refresh and replaying the request once, straight to
`fetch`, with the new token. If the token was already replaced while the
request was out, it replays without refreshing. A replay that is refused again
is returned as it is. The three auth calls use their own client and never
trigger a refresh.

Only a 401 on the refresh ends the session, and it clears the token from memory
at once, because access tokens outlive revocation until `exp` (row 9). Any other
answer - a 429, a 5xx - is handed to the waiting requests as their own, so each
screen shows `rate-limited` or `server-error` in place and the session stays.

The one deliberate exception is the reuse demonstration (inventory section
3.9), which calls `requestRefresh` twice at once because its purpose is to show
what single-flight prevents.

## Alternatives considered

### A refresh per failed request

The simplest interceptor. Rejected: on any screen with two requests it produces
the race above, and one of its two outcomes ends every session of the account.

### Refreshing ahead of expiry on a timer

Avoids most 401s. Rejected as the mechanism: the client clock is not trusted
(row 40), a background tab's timers are throttled, and a 401 can arrive for
reasons other than expiry - a token the API rejects must still be handled. A
proactive refresh could later sit on top of this one; it could not replace it.

### Queueing in the session provider

Keeping the queue in React state, next to the session. Rejected: the queue has
to hold requests the client is making, and the client sits in `lib/`, which
imports nothing above it (ADR 0003). The provider hears each outcome through
`onRefresh` instead.

## Consequences

A screen's code never sees a 401 caused by expiry and never refreshes; it sees
the replayed answer, or the refresh's own refusal. A session can end while a
screen is mounted, and the router then takes the user to sign-in with the
page kept as `next` (inventory section 2.4).

Building the application client and the auth client from one module without an
import cycle needs client creation in its own file, `src/lib/api/create-client.ts`.

Enforced by `src/lib/api/refresh.test.ts`: ten parallel 401s produce exactly one
refresh, the boot and a 401 share one, a replay refused again is not refreshed a
second time, and an auth call's 401 never refreshes. A refresh that gets no
answer at all rejects the waiting request like an unanswered `fetch`; the mock
cannot make a refresh unreachable, so that branch is not yet tested.
