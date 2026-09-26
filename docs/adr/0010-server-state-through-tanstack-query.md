# 0010 - Server state goes through TanStack Query, keyed by the URL, and belongs to one session

- **Status:** Accepted
- **Date:** 2026-09-26
- **PR:** #12

## Context

From the directory on, screens read the API: a page of users now, a user's
detail and the roles in PR 13, conditional requests in PR 14. Each read has the
same needs - loading, error, a retry the user asks for, the previous result kept
on screen while the next one loads (`loading-refetch`, inventory section 3.3) -
and the same constraints: reads are a hundred a minute per user (row 52), a 401
is already met by the silent refresh (ADR 0008), and the router is declarative,
so nothing fetches in a loader (ADR 0005).

The directory's state lives in the address bar (inventory section 5), so what
is fetched is a function of the URL.

## Decision

Every read goes through TanStack Query, pinned at 5.103.2. The query key is the
screen's URL state, so the address bar and the cache name the same thing and a
link reproduces a cached view. The directory keeps the previous page on screen
while the next loads (`placeholderData: keepPreviousData`).

The client in `src/app/query-client.tsx` does not retry and does not refetch on
window focus. A retry would spend the rate limit on a request the user did not
make, and every failure a retry could meet already has a state with its own
**Retry**: a 429 waits out `Retry-After`, a 5xx and an unanswered request say
so. A 401 never reaches a query at all.

The cache belongs to one session: whenever the access token is cleared - a sign
out, a session the API ended - every cached response is dropped, so the next
account on the tab never sees the last one's data.

## Alternatives considered

### Fetching in effects, per screen

No dependency. Rejected: each screen would re-implement the same states, and
keeping the previous page while the next loads, dropping a response that
arrives for a query no longer on screen, and a retry that refetches instead of
reloading are exactly what gets re-implemented wrongly.

### The router's loaders

Rejected with the data router in ADR 0005: a second fetching path beside the
one every mutation will need.

### Retrying 5xx automatically

TanStack Query's default. Rejected: the API's cold start is its own notice, a
5xx on a free instance is not made rarer by asking again at once, and each
attempt is one of the hundred.

## Consequences

A screen reads with one hook and renders from its states. The session provider
does not know the cache exists: `app/` listens to the access token store and
clears it. The version was chosen five days old rather than the latest of the
same day, which pnpm's release-age policy would have admitted only through an
exclusion written into `pnpm-workspace.yaml` (build plan section 14).

Enforced by `src/app/query-client.test.tsx` (the cache dropped when the token is
cleared and kept while it is replaced; no retry, no refetch on focus) and by the
directory's tests of `loading-refetch`, `error` and `rate-limited`.
