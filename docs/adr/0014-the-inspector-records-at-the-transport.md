# 0014 - The inspector records at the transport, keeps no credential, and belongs to one session

- **Status:** Accepted
- **Date:** 2026-09-27
- **PR:** #15

## Context

The inspector is the project's thesis: a reviewer should be able to see every
request the console sends and every answer it gets (inventory section 3.8, build
plan Gate 5). That claim is only as good as the place the record is taken. The
console sends requests through two clients - the application's, with the silent
refresh as middleware, and the auth client for sign-in, refresh and sign-out -
and the silent refresh sends its replay without going back through the
middleware, so a second 401 is returned rather than refreshed again (ADR 0008).

The record also has to live somewhere the client can write to. The client is in
`lib/api`, and `lib/` imports nothing above it (ADR 0003), so a store inside the
inspector feature cannot be fed by it.

What the record holds is a separate pressure. A sign-in body carries a password;
every authenticated request carries the access token; sign-in and refresh
answer with a new one. The panel is made to be looked at, screenshotted and
copied from, on a demo account shared by every visitor and, in development, by
an administrator. Inventory section 3.8 had asked only that `curl` leave the
token out.

## Decision

Every request reaches the network through one function, `transport` in
`src/lib/api/create-client.ts`, which both clients are built with and which the
silent refresh sends its replay through. It records the request in
`src/lib/api/capture.ts` the moment it leaves, as pending, and settles that
entry in place when the response arrives or nothing does. A response the console
builds itself - the refusal a waiting request is handed when its refresh was
refused - never crossed the network and is not recorded. The inspector feature
only reads the record.

Nothing recorded is a credential. At the moment of recording, the
`Authorization` header becomes `Bearer $TOKEN`, and in any JSON body, sent or
received, a `password` becomes `$PASSWORD`, an `accessToken` `$TOKEN` and a
`refreshToken` `$REFRESH_TOKEN`. Copy as `curl` leaves those as shell variables.
Bodies are kept to their first 64 kB.

The record belongs to one session: it is dropped when the access token goes from
held to none, as the query cache is (ADR 0010).

## Alternatives considered

### An openapi-fetch middleware registered on each client

The plan's "response interceptor". It sees what the middleware chain sees: not
the replay, which is sent past the chain on purpose, and not a request whose
`fetch` rejects before a response exists unless an error hook is kept in step.
Registering it on the auth client as well, in the right order relative to the
silent refresh, would make the record depend on registration order. The
transport is below all of that: if a request was sent, it went through it.

### The store in `features/inspector/`

Where the build plan's folder layout put it. The client would then have to
import a feature, which ADR 0003 forbids, or `app/` would have to wire the two
together at start-up, leaving a window in which requests are sent unrecorded.
The boot refresh is sent in exactly that window.

### Redacting when rendering and when copying

Leaves the credential in memory, in every place that reads the record, for as
long as the record lives, and makes each new view of it - a tooltip, a new copy
format - another place to forget. Redacting once, as the entry is written, makes
the rule hold by construction.

### Keeping the record for the life of the page

Simpler, and it would let `revoked` show the race's pair after the session
ends. It would also show the next account on the same tab the previous one's
responses, which is the exact reason the query cache is dropped with the
session. The pair is not kept, and inventory section 3.9 says so.

## Consequences

- A request cannot be sent unrecorded without bypassing `transport`, which only
  test code does: the mock's reset, and the helpers that assert on the wire.
  `src/lib/api/capture.test.ts`
  compares the record with what MSW saw cross the network, the 401, the refresh
  and the replay included, and fails when the replay is sent past the transport.
- No test, screenshot or clipboard can carry a credential from the inspector.
  `capture.test.ts` searches the whole record for the token and the password,
  and `src/features/inspector/curl.test.ts` and `e2e/inspector.spec.ts` check
  the copied command.
- The record reads a copy of each response body, so a response is handed to the
  client untouched, and its entry settles a moment after the client has it.
- A new credential-bearing field - an API key, a one-time code - has to be added
  to the list in `capture.ts`; nothing finds it otherwise.
- Only the response headers the API's CORS policy exposes can be recorded
  (observed row 53). The inspector says so under the panes.
