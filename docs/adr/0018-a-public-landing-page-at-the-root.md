# 0018 - A public landing page at the root

- **Status:** Accepted
- **Date:** 2026-11-24
- **Issue:** #89
- **Amends:** build plan decision 1, which made `/` a redirect to `/users`

## Context

The console is shared as a link. A visitor who followed it met the boot screen,
then a sign-in form: nothing said what the console is, who built it, or why it
is worth signing in to. The build plan left open whether `/` would be a landing
page or a redirect (section 14, PR 12), and PR 16 chose the redirect.

## Decision

The maintainer decided on 2026-11-24:

- **`/` is a public landing page**, always. A visitor whose browser had a
  session (ADR 0017's hint) is offered **Open console**, which goes to the
  directory; anyone else, **Try the demo**, which goes to sign-in, where the
  demo account is printed.
- **It sits outside the session boundary** and sends nothing to the API. The
  free instance may be asleep, and a first visit should not wait a minute for
  it to say what the console is. The cost: the page knows only the hint, not
  whether the session is still live. A stale hint costs one detour - the
  directory finds no session and asks for sign-in.
- **Content:** what the console is, the real directory screenshot, three
  features, a conditional read answered 304 as the proof of "does not hide
  HTTP", and "Built by Aleksa Dragnić" with links to both repositories.
- **Its own chunk**, loaded only at `/`, under the same CSP, bundle budget and
  design tokens as the console. The call to action is a ghost control: there
  is still no filled button (DESIGN-DECISIONS section 2).
- **Sign-in's default destination** becomes `/users`. Before, it was `/`, which
  was the directory.

## Consequences

- The landing page is in the accessibility spec in three browsers and in the
  Lighthouse budgets.
- A visitor with a session no longer lands in the directory by typing the bare
  address: one click more for the maintainer, the page for everyone else.
- The screenshot is a static asset, 1440 x 900 WebP; it goes stale when the
  directory changes and is replaced by hand, like the README's.

## Alternatives considered

- **A static, prerendered page before the SPA.** Best LCP and indexing, but a
  second build step and a second copy of the styles. The lazy route measured
  well within the budgets.
- **Redirect a signed-in visitor to `/users`.** Needs the session check, which
  the page would then wait for: the delay this decision removes.
