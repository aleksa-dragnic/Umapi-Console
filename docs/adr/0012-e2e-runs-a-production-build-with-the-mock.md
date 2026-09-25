# 0012 - End-to-end tests run a production build that includes the mock, and CI proves the real production build does not

- **Status:** Accepted
- **Date:** 2026-09-25
- **PR:** #9

## Context

The e2e job serves the production bundle over `vite preview`, so that what CI
checks is what is deployed (build plan section 14, PR 2). A production bundle
contains no mock (build plan Gate 2). Until PR 9 that did not matter: the one
spec rendered a static page and made no request.

From PR 9 every route asks the API whether a session exists before it renders
(ADR 0007). Served as it is deployed, the bundle would call the live instance
from `127.0.0.1`: a free host that sleeps for half a minute (observed row 35),
an origin its CORS configuration does not allow, and a rate limit shared with
every other visitor (row 52). A required check would then depend on all three.

The flows Gate 3 asks Playwright to prove - a reload that never flashes the
sign-in form, both outcomes of the refresh race - also need the mock's
scenario controls, which only exist where the mock does.

## Decision

Playwright runs against a bundle built with `vite build --mode e2e` into
`dist-e2e/`. The `e2e` mode is the production build - minified, compiled,
`import.meta.env.DEV` false, the specimen route removed - with one difference:
`src/main.tsx` starts the mock's service worker, exactly as the dev server does.
The condition is `import.meta.env.DEV || import.meta.env.MODE === 'e2e'`, two
literals the build replaces, so the production build removes the branch and
the dynamic import inside it.

The production build is asserted mock-free on every CI run: after `pnpm build`,
the `build-and-test` job fails if `dist/assets` contains `[MSW]`,
`Design specimen` or the mock administrator's password.

## Alternatives considered

### Playwright against the dev server

No second build and no new mode. Rejected because the dev server is the one
configuration that is never deployed: unminified, with development-only React
behaviour such as double-invoked effects, and the specimen route present.

### The mock in the Playwright process, intercepting the page's requests

Leaves the bundle untouched and lets a test call the mock's controls directly.
Rejected for now: it needs a further dependency to route requests into MSW's
handlers, and the refresh cookie would then be kept by the real browser rather
than by MSW's jar, which is not the behaviour the unit tests and the dev server
exercise. Two mock environments that differ on the one thing the auth flows
depend on would test different systems.

### Playwright against the deployed API

What M5 does, on demand, in `e2e/live/`. Rejected for a required check: a
flaky required check trains everyone to ignore red (working protocol section 6).

## Consequences

CI checks two bundles. The one Playwright drives differs from the deployed one
only by the mock, and the deployed one is proven to lack it - a claim that was
previously checked by hand in apply scripts is now checked on every push.

The worker file, `public/mockServiceWorker.js`, is copied into every build
already (build plan section 14, PR 8); in the production build nothing
registers it.

Enforced by `.github/workflows/ci.yml` (the bundle search) and
`playwright.config.ts` (the build command). The mock's scenario controls are
not yet reachable from a spec; the first spec that needs them, in PR 10, exposes
them in the `e2e` mode only, behind the same literal.
