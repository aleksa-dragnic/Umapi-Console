# 0011 - No state-management library, and collection state lives in the URL

- **Status:** Accepted
- **Date:** 2026-09-27
- **PR:** #13

## Context

With the user detail in place, the console holds four kinds of state: what the
API said (a page of users, one user, the roles), who is signed in (the access
token and what it permits), what a collection is showing (the page, the search
term, the sort, the status filter), and what one screen is doing at this moment
(a dialog open, a form being edited, a refusal on display).

The usual React answer is a store that holds all four: one place to read from,
one set of tools to inspect it. Every kind has a better home already. Server
state goes through TanStack Query (ADR 0010), which knows about staleness,
refetching and cancellation that a store would have to be taught. The access
token lives in a module that the client reads on every request and that nothing
may persist (ADR 0007). What is left is either shared through the address bar
or belongs to one component.

The directory is the screen this project is judged on, and a reviewer judges it
by the things a store makes easy to get wrong: a filtered view sent as a link,
Back through one's own searches, a reload that keeps the place.

## Decision

No state-management library is installed. Each kind of state has one home:

- **Server state** in TanStack Query, keyed by what identifies it (ADR 0010).
- **The session** in `lib/api/access-token.ts`, observed through
  `useAccessToken`; permissions are read from it (ADR 0009).
- **Collection state** in the query string: `page`, `q`, `sort` and `status`,
  read and written through `useSearchParams` (inventory section 5). An absent
  parameter is its default and is not written, an invalid one falls back, a
  change of filter returns to page 1, and the query key is the parsed URL state,
  so the address bar and the cache name the same view.
- **Navigation context** - which row a detail was opened from, the email to show
  while it loads - in the history entry's state, which Back restores and a new
  tab does not need.
- **Everything else** in the component that owns it, with `useState`.

A new piece of state is placed by that list. A second screen needing the same
local state is a reason to lift it to their common parent, not to add a store.

## Alternatives considered

### A global store (Redux Toolkit, Zustand)

Rejected. It would duplicate the cache TanStack Query already keeps and need
its own invalidation after every write; the rule that the cache belongs to one
session would have to be enforced twice. What remains for it to hold is local
to single screens, where a store adds indirection and nothing else.

### Collection state in component state, synchronised to the URL

The common arrangement, and the reason most React tables lose their place on
reload. Two sources of truth disagree the moment an effect runs late: Back
restores an address the table has not read, a debounced write races a filter
change. Rejected: the URL is the state, and the component derives from it.

### React context for session and permissions

Rejected. The access token changes outside React - the silent refresh replaces
it from the client's middleware (ADR 0008) - so a context would need a bridge
from that module anyway, and the module with `useSyncExternalStore` behind
`useAccessToken` already is one.

## Consequences

A view is a link, a reload keeps it, and Back steps through the user's own
searches and returns to the row that was opened, with no code that saves or
restores anything. The query string maps one-to-one onto the API's own query
(inventory section 5), so a request is predictable from the address bar.

The cost is discipline rather than code: there is no single place to inspect
all state, and a reviewer has to know the list above to find a piece of it.
Anything that should survive a reload but must not be shareable has no home;
nothing in v1 needs one.

Enforced by `src/features/users/url-state.test.ts` (defaults, fallbacks, page
reset), `e2e/directory.spec.ts` (a view survives a reload),
`src/features/users/DirectoryRows.test.tsx` (Back returns to the opened row),
and by `package.json`, where no store appears.
