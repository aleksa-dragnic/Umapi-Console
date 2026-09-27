# 0013 - The console keeps its own validators and bypasses the browser's HTTP cache

- **Status:** Accepted
- **Date:** 2026-09-27
- **PR:** #14

## Context

The API tags every read with an `ETag` and answers a matching `If-None-Match`
with 304 and an empty body, on the list and on the detail alike
(`docs/OBSERVED-BEHAVIOUR.md` rows 22-24). The tag is a hash of the body and,
on the list, of `X-Pagination` as well, compared weakly (row 44), so a 304
confirms the page and its position together. The console's thesis is that it
does not hide HTTP, and the screen inventory makes the 304 a state of its own
that is shown rather than absorbed (section 2.9).

Two parties could keep the validator. The browser already does: the API marks
its reads `Cache-Control: private, no-cache` (row 22), which tells the browser
to store the response and revalidate before reuse. When the browser revalidates
on its own, `fetch` resolves with the stored body and a status of 200 - the 304
that crossed the network is never seen by the page. The console, on the other
hand, already holds every response it has read, in TanStack Query's cache
(ADR 0010).

A validator kept apart from the body it validates can disagree with it: a tag
from one response sent with the body of another is a 304 that confirms the
wrong data.

## Decision

The console keeps its validators and the browser's HTTP cache is bypassed.

- Every request of the API client is made with `cache: 'no-store'`
  (`src/lib/api/create-client.ts`). The browser neither answers from its cache
  nor revalidates behind the console's back, so the status the console reports
  is the status on the wire.
- The `ETag` of each read is stored in the same TanStack Query cache entry as
  the body it came with. A read of a key already held sends that entry's tag as
  `If-None-Match`; a first read sends none.
- A 304 returns the data already held, with the same body object and status
  304. Nothing on screen re-renders; the directory's footer and the detail's
  concurrency panel say the read was confirmed.
- A 304 for a key the console holds nothing for is treated as any other
  unexpected status: it is shown, not guessed at.

## Alternatives considered

### Let the browser's cache do it

No code, and the bandwidth saving is the same. Rejected: the page cannot see a
304 the browser handled, and the one place this application exists to show one
would show a 200. It also moves the validator out of reach of the inspector
(PR 15), which is meant to record what was sent and what came back.

### A separate map of tags by URL

The usual hand-written arrangement. Rejected: it is a second cache beside the
one TanStack Query already keeps, with its own invalidation, and nothing ties a
tag to the body it describes. Keeping the tag inside the entry makes the pair
one value.

### `cache: 'no-cache'`

Rejected: it still lets the browser store responses and revalidate with its own
validators, and the page still receives a 200 for a 304.

## Consequences

Every re-read of a view the console already holds is a conditional request, and
the ones that change nothing cost an empty 304 rather than a body. The browser
keeps no copy of any API response, which also means a response is never served
from disk after sign-out. The status a screen reports is always the status on
the wire.

`If-None-Match` is not a CORS-safelisted header, so a conditional read is
preflighted; the API allows the header (row 53). Whether a 304 to a browser
origin carries the CORS headers was not measured - rows 23 and 24 were measured
without `Origin` - and is proven by the live specs in M5.

Enforced by `src/lib/api/client.test.ts` (every request is `no-store`),
`src/features/users/api.test.ts` (no validator on a first read, the kept one on
the next, the same body on a 304, a 200 after a write),
`src/features/users/DirectoryScreen.test.tsx` and
`src/features/users/DetailScreen.test.tsx` (`not-modified`), and
`e2e/directory.spec.ts` and `e2e/detail.spec.ts` (304 in the browser).
