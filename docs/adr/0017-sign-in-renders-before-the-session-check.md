# 0017 - Sign-in renders before the session check, for a browser that had no session

- **Status:** Accepted
- **Date:** 2026-11-24
- **PR:** #81
- **Amends:** [0007](0007-refresh-token-in-an-httponly-cookie.md)

## Context

The boot screen (inventory section 3.1) waits for `POST /auth/refresh` before
any route renders, so that a signed-in user reloading a deep route never sees
the sign-in form flash. It held for everyone, including the many visitors who
have no session at all: they looked at the app mark until the API answered,
and only then at sign-in.

The Web Vitals budgets (#63) measured that cost on the mobile profile: sign-in's
largest paint at 3.2-3.5 s against a 2.5 s budget, with FCP at 0.8 s. The first
paint was the boot screen, and the sign-in paragraph waited in "element render
delay" for the check (#76). Against the deployed API the wait is a cross-origin
round trip with a preflight, and on a cold start up to a minute. Removing the
entrance animation's fade saved about 0.2 s, not enough.

The console cannot see the refresh cookie (HttpOnly, ADR 0007), so it cannot
know without asking whether a visitor has a session. It can remember whether
it had one.

## Decision

A **session hint**: `localStorage["umapi.session"] = "1"` while this browser has
a session, removed when it ends (`src/lib/api/session-hint.ts`).

- **Set** whenever the session becomes authenticated: sign-in, and a refresh
  that returns a token. **Removed** when it becomes anonymous: sign-out, a 401
  from any refresh. A 429 or no answer says nothing and changes nothing.
- **With the hint**, boot is unchanged: the boot screen until the check
  answers. A user who has a session still never sees sign-in flash.
- **Without it**, the provider starts `anonymous`: sign-in renders at once,
  and the same refresh runs behind it. A token signs the visitor in, and
  sign-in sends them on; a 401, a 429 or no answer leaves them on sign-in,
  since nobody was waiting for it.
- A check still in flight never overrules the user: sign-in and sign-out each
  start a new generation, and a late answer for the old one is ignored.
- Storage that throws (a private window, blocked site data) reads as "no hint".

ADR 0007's rule "nothing is kept in browser storage" becomes: **no credential is
kept in browser storage**. The hint is one boolean. An injected script learns
from it only that this browser had a session, which it could learn by calling
the refresh endpoint itself. The lint ban on storage keeps exactly one
exception for it, next to the mock's.

## Consequences

Sign-in's largest paint on the mobile profile went from 3.24 s to 0.76-0.78 s;
the directory and the detail, behind a session, are unchanged at 1.69 s, as
intended.

- A user whose hint is gone but whose cookie is valid - storage cleared, the
  first visit after this change was deployed - sees sign-in for the length of
  one refresh, and is then sent on. That is the one place sign-in can flash for
  someone signed in, and it is bounded by the check.
- Two tabs share the hint. Signing out in one removes it; the other keeps its
  session in memory until its next refresh says otherwise, as before.
- A browser with a hint whose session ended elsewhere (revoked, expired) still
  sees the boot screen first, then sign-in, as before.

## Alternatives considered

### A non-HttpOnly marker cookie set by the API

Would let the hint survive storage clearing, but it needs an API change, a
cross-site cookie the console's origin cannot read anyway (the API is another
origin), and gives nothing the storage hint does not.

### Keep the order and accept the budget

Sign-in would have a budget of its own (3.5 s). Rejected because the wait it
accepts is the deployed API's round trip, worst on the first visit, which is
when it matters most.
