# 0001 - A Vite SPA rather than a framework with server rendering

- **Status:** Accepted
- **Date:** 2026-09-18
- **PR:** #1

## Context

This console sits entirely behind a login. Every route it serves requires an
access token, and none of its content is ever crawled, linked or shared
publicly. The obvious default in 2026 is a framework with server rendering, and
choosing against a default needs a reason on the record, because "why not Next"
is the first question this repository will be asked.

The deployment target also matters. The API runs on a free instance that
suspends when idle; adding a second always-on server for rendering would double
the infrastructure the demo depends on, and the second one would exist purely to
render pages that only an authenticated user ever sees.

There is a third constraint. Server rendering an authenticated application means
the access token has to reach the server, which either puts it in a cookie the
server reads or in a session store. The whole point of section 4.5 of the build
plan is that the access token lives in memory and nowhere else.

## Decision

The console is a Vite single-page application with React Router in declarative
mode. There is no server-rendered route, no loader running on a server, and no
server-side session. Static output is served by Cloudflare Pages.

## Alternatives considered

### React Router in framework mode

Would give loaders, actions and server rendering with the same routing library.
Rejected because it needs a Node process in production, which is a second
service to deploy, monitor and keep awake for content nobody can see without
signing in first. The loader pattern would also have to reach the API with the
user's token, which means the token leaves the browser.

### Next.js with the App Router

The same objection, plus a larger framework surface than this application uses.
React Server Components are worth demonstrating in a project whose content is
public; this project's content is not.

### Astro with an island for the console

Attractive if a public landing page is added later, because the marketing half
would be static and the console an island. Rejected for now because the landing
page is an open decision (build plan section 12) and building the whole
application around a page that may not exist is the wrong order.

## Consequences

The first paint is a blank page until the JavaScript bundle loads, which is
acceptable behind a login and is why the `boot` screen in the screen inventory
exists rather than being an afterthought.

Deployment is a static upload with no runtime, so there is no server to fail
during a demo and no cold start on the console side - only on the API's.

If the landing page in build plan section 12 is built, it is a static route in
the same application rather than a reason to revisit this decision.

Nothing enforces this decision automatically. It is a structural choice that a
reviewer can see from `vite.config.ts` and the absence of a server entry point.