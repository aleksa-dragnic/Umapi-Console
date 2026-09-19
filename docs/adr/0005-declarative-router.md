# 0005 - React Router in declarative mode, installed with the specimen route

- **Status:** Accepted
- **Date:** 2026-09-19
- **PR:** #4

## Context

The build plan describes `/_design` as a route: a page, reachable at an
address, where every primitive is reviewed in every state for the rest of the
project. Nothing in the repository routes anything. `main.tsx` mounts a single
component, and the only address the application answers is `/`.

That leaves two ways to build the specimen page. It can be mounted
conditionally without a router, and routing can arrive later with
authentication. Or the router arrives now, and the specimen page is the first
thing mounted on it.

The choice is not really about this page. It is about what the authentication
pull request contains. That PR already introduces a session provider, a token
kept in memory, a login form with field-level errors from problem details, and
a boot screen whose entire purpose is that an authenticated user reloading a
deep route never sees the sign-in form. Adding "and also introduces routing" to
that list makes the first genuinely difficult PR in the project carry an
unrelated foundation as well.

## Decision

React Router is a dependency from this pull request, pinned exactly at the
version read from the registry, and used in **declarative** mode:
`BrowserRouter` at the root, a `Routes` element, and `Route` children.

The route table lives in `src/app/AppRoutes.tsx` and nowhere else. `main.tsx`
mounts `BrowserRouter` around it. A feature does not declare its own routes;
`app/` composes features, which is the direction the layering already runs.

Data routers, loaders, actions and framework mode are not used. Server state is
TanStack Query's job from PR 5 onwards, and a loader that fetches while the
query client also fetches is two caches for one resource.

## Alternatives considered

### Mount the specimen page without a router

A `import.meta.env.DEV` check in `main.tsx` choosing between `App` and the
specimen page. It is fewer lines and one fewer dependency until PR 7.

Rejected because the thing being built is a route. Without a router it has no
address, cannot be linked to, is not reachable by reload, and the review that
happens on it for the next eleven pull requests happens by editing a file. It
also postpones nothing: the router still has to arrive, and it arrives inside
the authentication PR, where a routing mistake looks like an auth bug.

### A data router with `createBrowserRouter`

The route objects would be ready for loaders later. Rejected because loaders
are the feature that is explicitly not wanted - this application fetches
through TanStack Query, and a data router invites a second fetching path that
would have to be argued against in every review. Declarative mode is also what
the build plan pins, and there is no evidence here to overturn it.

### React Router's framework mode, or a framework

Closed by ADR 0001. A console behind a login has no SEO benefit, and server
rendering puts tokens somewhere they do not need to be.

## Consequences

Routing exists before authentication needs it, so PR 7 adds routes to a router
rather than introducing both at once, and the guarded routes of PR 9 have
something to guard.

`/_design` is development-only, and the guard is a build-time literal rather
than a runtime check: `AppRoutes` reads `import.meta.env.DEV`, so the branch
and the dynamic import inside it are removed from the production bundle. The
apply script greps `dist/` after `pnpm build` to prove the module is absent
rather than merely unreachable. Nothing asserts this in CI yet; if the specimen
page grows, that grep belongs in the workflow.

Navigation primitives - links, the active state that is the one place signal
blue appears - are not built here. They arrive with the app shell in PR 14,
against the design decisions' navigation rules.
