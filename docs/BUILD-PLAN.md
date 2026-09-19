# umapi-console — Build Plan

An admin console for [UserManagementAPI](https://github.com/aleksa-dragnic/UserManagementAPI),
built as a separate repository and connected across the network.

This document is the working plan: what the project is, how it is structured,
how it gets built, and the rules followed while building it. It lives in the
repository at `docs/BUILD-PLAN.md`.

---

## 1. What this project is

A React single-page application that drives the full surface of
`UserManagementAPI`: authentication with silent token refresh, a paginated and
searchable user directory, user detail, role assignment, and lock/unlock.

**The thesis, in one sentence: an admin console that does not hide HTTP.**

Most portfolio frontends treat the API as plumbing to be concealed. This one
does the opposite. Every action can be inspected — the request that went out,
the status that came back, the problem details body, the `ETag`, the
`X-Pagination` header. A reviewer opening the live demo can watch a 409 happen
when two tabs race, a 422 name the field that failed, a 403 refuse a write from
the published demo account, a 429 arrive on the eleventh login attempt, and a
413 reject an oversized body.

That framing is deliberate. The job being applied for is backend. A frontend
that makes the backend legible is worth more than one that makes it invisible.

**Design goals**

| Goal | How it shows up |
|---|---|
| The contract is enforced, not assumed | Types are generated from the deployed OpenAPI document. CI fails when the frontend and the API disagree. |
| Behaviour is measured, not believed | What the OpenAPI document cannot express — headers, cache semantics, rate limits — is probed against the deployed instance before it is mocked. Section 3.4. |
| The API is visible | A request inspector is a first-class feature, not a debug panel. |
| Permissions come from the token | Buttons and routes read permissions from JWT claims. Nothing is hardcoded to a role name. |
| The refresh token never touches JavaScript | `HttpOnly` cookie, host-only, `SameSite=Strict`, scoped to the refresh path. |
| Design rules are asserted | Contrast ratios are a test, not a paragraph. |
| Every state is designed before it is built | `docs/SCREEN-INVENTORY.md` enumerates the screens and their states; nothing is improvised mid-PR. |
| It can be built alone | The repository develops, tests and ships against mock handlers with no running API and no domain. |

**Non-goals.** No server-side rendering — see section 4.1. No analytics
dashboard: the API has no analytics endpoints and inventing them in the backend
to give the frontend something to chart would be building backwards. No
multi-tenancy or organisation switcher; ADR 0015 in the API closes that
deliberately and the frontend respects it.

---

## 2. Stack

| Concern | Choice | Status |
|---|---|---|
| Runtime | Node 22 LTS | Required by React Router v8 |
| Package manager | pnpm | Pin exact version in `package.json` |
| Language | TypeScript, `strict` | |
| Library | React 19 | **19.3.0**, released 9 September 2026 |
| Build | Vite 7 | Required by React Router v8 |
| Routing | React Router v8, **declarative mode** | **8.3.0**, July 2026 |
| Styling | Tailwind CSS v4, `@theme` | Token block comes from `docs/tokens.css` |
| Server state | TanStack Query | Pin latest major at PR 1 |
| URL state | `useSearchParams` | No third library; see section 5.3 |
| API types | `openapi-typescript` | Generated from the live `/openapi` document |
| API client | `openapi-fetch` | ~6 kB, typed, no generated classes |
| Mocking | MSW | Handlers typed from the same generated types |
| Fonts | Fontsource, `latin` + `latin-ext` | Self-hosted, no CDN |
| Unit / component tests | Vitest + React Testing Library | |
| End-to-end | Playwright | |
| Accessibility | `axe-core` in Playwright, plus a contrast unit test | |
| Compiler | React Compiler | Decide at PR 1 — see below |
| CI | GitHub Actions | |
| Hosting | Cloudflare Pages | Static, free, preview deploy per pull request |

**Versions.** React 19.3.0 and React Router 8.3.0 were confirmed against
`react.dev/versions` and the React Router changelog on 13 September 2026.
Everything marked "pin at PR 1" is to be checked against its registry at that
point rather than guessed — the same rule the API repository follows.

**React Compiler.** No longer experimental. Enabled, it makes manual `memo`,
`useMemo` and `useCallback` largely unnecessary, which is a decision about how
performance work is done in this codebase rather than a build flag. It belongs
in PR 1 with an ADR either way; what is not acceptable is enabling it and still
hand-memoising, or disabling it without saying why.

**Deliberate omissions.** No Redux or Redux Toolkit — the only genuinely global
state is the auth session, and Redux for that is equipment that outweighs the
job. No component library (MUI, Chakra, shadcn) — the design is specific enough
that a library would be fought more than used, and building the primitives is
the part that demonstrates anything. No `styled-components`: effectively legacy
in 2026, and Tailwind v4 already consumes the design tokens directly.

---

## 3. Independence, and the two things that must be settled first

This repository is built to completion without the API repository being touched
and without a domain existing. M0 through M4 run entirely against MSW. The two
systems meet once, in M5, and that meeting is a milestone rather than a
condition of starting.

That is deliberate. Coupling two repositories at the start means neither can
move until both are ready; coupling them at the end means the joining itself is
a piece of work with its own tests and its own pull request.

Independence has a price, and it is paid here: **a mock is only as good as the
knowledge it encodes.** Two things therefore have to be settled before anything
is mocked — the auth contract on paper (3.2) and the API's observable behaviour
measured against the live instance (3.4). Both are cheap now and expensive in
M5.

### 3.1 What is genuinely needed up front

| Need | Why | When |
|---|---|---|
| An empty repository with one commit on `main` | Every apply script's pre-flight assumes a repository that exists and a `main` in sync with `origin/main` | M-1 |
| Node 22 LTS, pnpm via `corepack enable` | Toolchain | M-1 |
| `docs/tokens.css` | The `@theme` block PR 1 imports. Written from `docs/DESIGN-DECISIONS.md`, sections 3, 4, 6 and 11 | PR 1 |
| The deployed API's `/openapi` document, read-only | Generates `schema.d.ts`; the API is already live and this changes nothing in it | PR 5 |
| **The API's observed behaviour, measured and written down** | See 3.4 | Before PR 6 |
| **The auth contract frozen on paper** | See 3.2 | Before PR 6 |

No secret is needed to develop or test. No domain is needed before M5.

### 3.2 The auth contract must be decided before it is mocked, not before it is merged

The refresh token moves from the JSON body into an `HttpOnly` cookie. That is a
change in the API repository, and it lands in M5. What cannot wait until M5 is
the *shape* of it, because MSW handlers written in M1 encode that shape and
every auth test asserts against it. A guess there means M5 is a redesign instead
of a connection.

So before PR 6, this table is fixed and written into `docs/adr/`:

| Question | Decision |
|---|---|
| Cookie name | `umapi_rt` |
| Attributes | `HttpOnly`, `Secure`, host-only (no `Domain`), `SameSite=Strict`, `Path=/api/v1/auth/refresh` |
| Set by | `POST /auth/login` and `POST /auth/refresh` |
| Cleared by | `POST /auth/logout`, and by the API when reuse is detected |
| Login response body | Access token, expiry, nothing else — the refresh token leaves the body |
| Refresh request body | Empty. The cookie is the credential. |
| Client fetch | `credentials: 'include'` on every call to the API origin |

MSW implements exactly this. The API is made to match it in M5.

### 3.3 The domain is a hard requirement of M5, not a nicety

`SameSite=Strict` is evaluated against the registrable domain. `onrender.com`
and `pages.dev` are both on the Public Suffix List, so a console on
`*.pages.dev` calling an API on `*.onrender.com` is a **third-party** context:
the cookie is never sent, and the refresh flow does not work at all. It is not a
degraded experience, it is a broken one.

Therefore M5 requires one registrable domain with `console.<domain>` pointed at
Cloudflare Pages and `api.<domain>` pointed at Render. Cost is the domain
registration; both platforms attach custom domains on the free tier.

Until then, development runs the API and the console on `localhost`, where the
same-site rule already holds.

### 3.4 The OpenAPI document does not describe the behaviour the console depends on

`schema.d.ts` gives paths, shapes and status codes. It says nothing about the
things this console is built around:

- that a repeated `GET` with `If-None-Match` answers **304** with no body, and
  that the `ETag` changes after a write
- what the `X-Pagination` header actually contains, and that page size is
  clamped rather than honoured
- that an unknown sort field is ignored while an unknown status filter is a 422
- that the eleventh login attempt in a minute is a 429, and what `Retry-After`
  carries
- that the published demo account is refused a write with 403
- that refresh-token rotation revokes the whole chain when a superseded token is
  replayed
- how long a cold start takes, and what a readiness probe against a stopped
  database returns

Every one of those is a state in `docs/SCREEN-INVENTORY.md`. If the mock
encodes what the API's README claims instead of what the deployed instance does,
then M2 and M3 are built on a document rather than a system, and M5 discovers it
too late to be cheap.

So the probe in **Gate 0** of section 8 runs against the deployed instance
first, and its results are written into `docs/OBSERVED-BEHAVIOUR.md` — one line
per behaviour, with the request, the response and the date. That file is the
source the MSW handlers are written from, and it is what a reviewer can check
the mock against.

---

## 4. Architecture

### 4.1 Why a SPA and not a framework

The CV this project supports claims React 18, Vite and feature-module
architecture. A Vite SPA proves that claim. Server-side rendering a
behind-login admin panel has no SEO benefit, introduces a second server on a
free tier, and puts tokens somewhere they do not need to be. React Router's
framework mode and RSC are worth demonstrating — in a project whose content is
public, which this is not.

Recorded as an ADR, because "why not Next" is the first question this repository
will be asked.

### 4.2 Folder layout

```
umapi-console/
├── .github/workflows/ci.yml
├── docs/
│   ├── BUILD-PLAN.md
│   ├── SCREEN-INVENTORY.md
│   ├── DESIGN-DECISIONS.md
│   ├── OBSERVED-BEHAVIOUR.md
│   ├── tokens.css
│   └── adr/
├── src/
│   ├── app/              Router, providers, error boundaries, app shell
│   ├── features/
│   │   ├── auth/         Login, session, silent refresh, permission gates
│   │   ├── users/        List, detail, roles, lock/unlock
│   │   └── inspector/    Request/response capture and rendering
│   ├── lib/
│   │   ├── api/          Generated types, openapi-fetch client, interceptors
│   │   ├── design/       Token module, contrast helper
│   │   └── testing/      MSW handlers, render helpers, factories
│   └── ui/               Primitives: Button, Input, Card, Table, Badge, Dot,
│                         CodeWindow, Dialog — the design system, no features
├── e2e/                  Playwright specs
├── index.html
├── package.json
└── vite.config.ts
```

**The rule that makes this a feature-module architecture rather than folders
with nice names:** `ui/` may not import from `features/`, and one feature may
not import from another. Cross-feature needs go through `app/` or `lib/`. This
is enforceable, and section 10 says how.

### 4.3 Layers

```
app  ──────►  features  ──────►  lib
 │                │                ▲
 └────────────────┴────► ui ───────┘
```

`ui/` knows tokens and nothing else. `features/` knows `lib/` and `ui/`.
`app/` composes features. Nothing points back up.

### 4.4 The API boundary

Types are generated from the deployed OpenAPI document into
`src/lib/api/schema.d.ts`, committed, and regenerated by a script. CI
regenerates and fails if the result differs from what is committed — so a
backend change that breaks the contract breaks the frontend build, visibly,
instead of at runtime in front of a reviewer.

`openapi-fetch` wraps it with one client instance carrying:

- the access token from memory, as an `Authorization` header
- `credentials: 'include'`, so the refresh cookie travels
- a response interceptor that captures method, path, status, timing and
  selected headers into the inspector store
- a 401 handler that triggers exactly one silent refresh, with concurrent
  requests queued behind it rather than each firing its own

That last point is the single most common bug in hand-rolled auth clients: ten
parallel 401s producing ten refresh calls, nine of which rotate a token that
has already been rotated and trip the API's own reuse detection — which then
revokes the whole chain and logs the user out. Single-flight is not an
optimisation here; without it the feature is wrong.

### 4.5 Session and tokens

| | Where | Why |
|---|---|---|
| Access token | Memory only, in a provider | Never in `localStorage`; an XSS cannot read what is not stored |
| Refresh token | `HttpOnly` cookie set by the API | JavaScript cannot read it at all |
| Cookie attributes | Section 3.2 | Same-site because `console.` and `api.` share the registrable domain, so it is never a third-party cookie. `Strict` removes CSRF on that endpoint without a separate token. |
| Permissions | Decoded from the access token's claims | The UI reflects what the token allows, not what a role name implies |

A page reload therefore has no access token and must attempt a silent refresh
before deciding whether the user is signed in. Getting that flicker-free — no
flash of the login screen for an authenticated user — is part of the auth
milestone, and is the `boot` screen in the inventory.

---

## 5. Screens, states and URLs

`docs/SCREEN-INVENTORY.md` is the companion document: twelve screens, their
states, the trigger for each state, and what the user can do next. It is written
before the code and is the source the PRs are built from.

Three rules from it belong here because they shape the architecture.

### 5.1 Every screen owns four states at minimum

Loading, empty, error, and ready. A screen that has no empty state has not been
designed, it has been drawn. The inventory names the copy for each.

### 5.2 Cross-cutting states are handled once

Cold start, offline, 401 → refresh, 403, 429 and 5xx are defined once in the
inventory and rendered by shared components, not re-implemented per feature.

### 5.3 Collection state lives in the URL

Search term, page number, sort field and direction, and status filter are query
parameters, read and written through `useSearchParams`. Consequences, all of
them the point:

- a filtered view is a link that can be sent to someone
- the browser Back button steps through the user's own searches
- a reload restores the view rather than resetting it
- the query string maps one-to-one onto the API's own query contract, so the
  request is predictable from the address bar

The alternative — component state with the URL as an afterthought — is the
default in most React applications and is why most React tables lose their place
on reload.

---

## 6. Features

### 6.1 Authentication
Login form with field-level errors from the API's 422 problem details. Silent
refresh with single-flight. A visible "simulate token reuse" action that replays
a superseded refresh token, shows the chain being revoked and the session ending
— the API's reuse detection is the most interesting thing in it and has never
been demonstrated.

### 6.2 User directory
Paginated table reading `X-Pagination`. Debounced search. Sorting on the
whitelisted fields. Filtering by status. All of it in the URL. Conditional GET:
the `ETag` is kept and sent back as `If-None-Match`, and a 304 is shown as a 304
rather than hidden.

### 6.3 User detail and mutations
Role assignment, lock and unlock, profile update. Optimistic updates with
rollback. A 409 from the API's optimistic concurrency is surfaced as a real
conflict with a "reload and retry" affordance, not as a generic error toast.

### 6.4 Permission-driven UI
Route guards and action affordances derive from token claims. The published demo
account holds `users.read` and `roles.read`, so a visitor sees write actions
disabled with a reason, then can sign in as an administrator and watch them
unlock. This is the cheapest feature here and the most convincing.

### 6.5 The inspector
A dockable panel listing every request the session made: method, path, status
dot coloured by class, duration, and an expandable request/response pair
rendered in the design's code-window component. Copy as `curl`. This is where
the design language and the thesis meet — the tokens already describe terminal
windows and status dots, so the feature is styled by the design rather than
decorated on top of it.

---

## 7. Milestones

A bootstrap step and six milestones, fifteen pull requests. One branch per PR,
one squash-merged commit on `main`, build green at every step. M0 through M4
have no dependency on the API repository or on any infrastructure.

At roughly 10–12 hours a week: **7 to 8 weeks**, plus Gate 0.

### M-1 — Bootstrap (manual, no pull request)

Half an hour by hand. It exists as a named step because every apply script's
pre-flight assumes a repository that already has a `main`, and PR 1 cannot
satisfy that assumption while creating it.

| # | Step | Done when |
|---|---|---|
| 1 | Create `umapi-console` on GitHub — public, no template, no `.gitignore`, MIT licence | The repository exists and is empty apart from `LICENSE` |
| 2 | Clone it, add a one-line `README.md` naming the project and linking the API repository, commit, push | `git log` on `main` shows one commit, and `git status` is clean |
| 3 | `node --version` reports 22.x; `corepack enable`; `pnpm --version` reports something | Both commands answer without an error |
| 4 | Read the current versions of React, React Router, Vite, Tailwind, TanStack Query, MSW, Vitest and Playwright from their registries and write them into the chat | Section 2's "pin at PR 1" entries have real numbers, not remembered ones |
| 5 | Confirm the repository is reachable over SSH and note whether `ssh-agent` is running | A push succeeds, or the passphrase prompt is expected for the rest of the project |

Step 4 is not optional bookkeeping. Protocol section 8 forbids quoting a
version from memory, and every number in section 2 of this document was written
on 13 September 2026.

**Unblocks:** PR 1.

### M0 — Foundation (4 PRs)

| PR | Branch | Contents |
|---|---|---|
| 1 | `chore/scaffold` | Vite + React 19 + TS strict, pnpm pinned at the version read in M-1, ESLint and Prettier, Tailwind v4 importing `docs/tokens.css`, Vitest, path aliases. The four documents — `docs/BUILD-PLAN.md`, `docs/SCREEN-INVENTORY.md`, `docs/DESIGN-DECISIONS.md`, `docs/tokens.css` — plus an empty `docs/OBSERVED-BEHAVIOUR.md` with its column headers. React Compiler decision with its ADR. |
| 2 | `ci/build-and-test` | GitHub Actions: install, typecheck, lint, unit tests, build. Playwright installed and running one smoke spec. **Branch protection configured and verified: both checks required, enforcement active on the default branch, required approvals 0.** |
| 3 | `feat/design-primitives` | `ui/`: Button (ghost, destructive, disabled-with-reason), Input, Card, Badge, StatusDot, CodeWindow, Table shell, Dialog with focus trap. The contrast test. |
| 4 | `feat/specimen-route` | `/_design`, dev-only: every primitive in every state from the inventory, on one page. The route the design is reviewed on for the rest of the project. |

**Exit:** Gate 1 in section 8.

### M1 — Contract and mocks (2 PRs)

| PR | Branch | Contents |
|---|---|---|
| 5 | `feat/api-types` | `openapi-typescript` generation from the deployed document, committed output, a drift check in CI, the `openapi-fetch` client with `credentials: 'include'`. |
| 6 | `feat/msw-handlers` | MSW handlers typed from the generated schema, plus factories. The whole surface including 304, 401, 403, 409, 422, 429, 503, and a settable cold-start delay — each behaviour matching a line in `docs/OBSERVED-BEHAVIOUR.md`. The cookie contract from section 3.2 implemented in the mock. |

**Exit:** Gate 2.

### M2 — Authentication (3 PRs)

| PR | Branch | Contents |
|---|---|---|
| 7 | `feat/login` | Login route, form with 422 field errors, session provider, access token in memory, the `boot` screen. |
| 8 | `feat/silent-refresh` | Refresh on 401 with single-flight queueing, reload rehydration without a login flash, logout. |
| 9 | `feat/permission-gates` | Claim decoding, route guards, action gating with a stated reason, and the reuse-detection demonstration. |

**Exit:** Gate 3.

### M3 — The directory (3 PRs)

| PR | Branch | Contents |
|---|---|---|
| 10 | `feat/user-list` | Table, pagination from `X-Pagination`, debounced search, sorting, status filter — **all of it in the query string** — plus the empty, loading and error states from the inventory. |
| 11 | `feat/user-detail` | Detail route, profile update, role assignment dialog, lock/unlock, optimistic updates with rollback. |
| 12 | `feat/conditional-get` | `ETag` retention, `If-None-Match`, 304 handling, and the 409 conflict path made explicit. |

**Exit:** Gate 4.

### M4 — The inspector and the shell (2 PRs)

| PR | Branch | Contents |
|---|---|---|
| 13 | `feat/inspector` | Capture store, dockable panel, status dots, request/response rendering, copy as `curl`. |
| 14 | `feat/app-shell` | Navigation, the editorial sign-in screen at display type sizes, cold-start handling, the 404 route, the error boundary, the narrow-viewport layout. |

**Exit:** Gate 5.

### M5 — The bridge (1 PR here, 1 PR in the API, then manual)

This is the milestone where the two repositories meet. It is ordered, and each
step is verified before the next begins — Gate 6.

| Step | Where | Contents |
|---|---|---|
| 1 | `UserManagementAPI` | The cookie pull request: refresh token moves from the response body to the `HttpOnly` cookie of section 3.2, `POST /auth/refresh` reads it, `POST /auth/logout` clears it, reuse detection clears it. CORS given the exact console origin with `AllowCredentials`. Its own tests. |
| 2 | Local | Console pointed at the local API over `localhost`. Full flow verified by hand. |
| 3 | Infrastructure | Domain registered. `console.<domain>` → Cloudflare Pages, `api.<domain>` → Render. `ASPNETCORE_HTTPS_PORT` and the CORS origin updated in the Render dashboard, which does not read `render.yaml`. |
| 4 | `umapi-console` PR 15, `docs/release-1.0` | Playwright specs against the deployed API, accessibility pass, README with the architecture diagram, screenshots and the demo credentials, the ADR index, cross-links to the API repository. |

**Exit:** `v1.0.0` tagged, one live URL, the console driving the deployed API,
and both READMEs pointing at each other.

---

## 8. Verification order

The spine of the project. Each gate states what must be true, **how it is
proven**, and what it unblocks. Two rules govern all of them:

1. **A gate is closed by evidence, not by an opinion.** A command with its
   output, a test with its count, a screenshot. "I did that" and "that is in
   effect" are different claims; only the second closes a gate.
2. **Nothing in a later gate starts while an earlier one is open.** A gate that
   fails is not a setback, it is the gate doing its job — and it costs hours
   where the same discovery in M5 costs a redesign.

Per-PR verification sits inside each apply script — typecheck, lint, tests,
build, invariant greps — and is not repeated here. These gates are the checks
that span a milestone.

### Gate 0 — the API is measured before it is mocked

**Before PR 6. Roughly 30–40 minutes against the deployed instance.** Results
go into `docs/OBSERVED-BEHAVIOUR.md`, one line each: request, response, date.

Run in this order, because each depends on the one before:

| # | What | Proven by | If it differs from the README |
|---|---|---|---|
| 1 | Login works and returns a usable access token | `POST /api/v1/auth/login` with the demo account | Everything below is blocked; fix first |
| 2 | Cold start and readiness | First request after an idle period, timed; readiness with the database down | The `cold-start` copy and its 1200 ms threshold are retuned |
| 3 | `X-Pagination` contents and page-size clamp | `GET /api/v1/users?pageSize=500`, read the header | `lib/api/pagination.ts` and the directory footer follow the header, not the guess |
| 4 | Conditional GET | Take the `ETag`, repeat with `If-None-Match`; then write and re-read | A 304 that never arrives makes PR 12 a different PR |
| 5 | Sorting and filtering | `orderBy=email desc`; an unknown sort field; an unknown status | Decides whether the toolbar disables a control or shows a 422 |
| 6 | Demo account boundary | `POST /api/v1/users` as demo → expect 403 | The `gated` state's reason text comes from the real claim set |
| 7 | Rate limiting | Eleven logins in a minute; read `Retry-After` | The countdown in `rate-limited` uses the real header, or a fallback |
| 8 | **Refresh rotation and reuse detection** | Log in, refresh, replay the **old** refresh token | **The one that can change the plan.** Section 3.9 of the inventory and part of PR 9 exist only if the chain really is revoked |
| 9 | Versioning, HATEOAS, body limit, security headers | `/api/v2/users/{id}`, the vendor media type, an oversized body, response headers | Affects what the inspector has to render, not whether it works |

**Unblocks:** PR 6, and with it all of M2 and M3.

Item 8 is the one to run first if time is short. The console's session screen,
its reuse-detection demonstration and a third of what makes the project
interesting all assume a behaviour that has never been driven end to end.

### Gate 1 — the foundation holds (end of M0)

| What | Proven by |
|---|---|
| The pipeline works on a clean runner | CI green on the merge commit on `main`, not only on the pull request |
| Branch protection is actually in effect | `gh api repos/<owner>/umapi-console/branches/main/protection` lists both checks, enforcement active, approvals 0 |
| Contrast rules are enforced, not written | The contrast unit test fails when `Charcoal` is added to the text set |
| Feature-module boundaries are enforced | A deliberate import from `ui/` into `features/` fails lint |
| The design is reviewable | `/_design` renders every primitive in every state; reviewed in the browser at both densities |

**Unblocks:** M1.

### Gate 2 — the mock is trustworthy (end of M1)

| What | Proven by |
|---|---|
| Generated types match the deployed document | The drift check fails when `schema.d.ts` is edited by hand |
| Every mocked behaviour has a measured source | Each handler branch cites a line in `docs/OBSERVED-BEHAVIOUR.md` |
| The application runs with the API switched off | Dev server and the full test suite pass with no network access to the API |
| The cookie contract is implemented in the mock | A refresh with no cookie is a 401; with the cookie, a 200 |

**Unblocks:** M2. This is the most important gate in the project: everything
from here to M5 is written against this mock, so a wrong mock is a wrong
application that passes all of its tests.

### Gate 3 — auth is correct, not merely working (end of M2)

| What | Proven by |
|---|---|
| A reload of a deep route never flashes the sign-in screen | Playwright: authenticated, reload `/users/<id>`, assert the sign-in form never mounts |
| Ten parallel 401s produce exactly one refresh | A test counting refresh calls while firing concurrent requests |
| The access token is never written to storage | The lint rule, plus a test asserting storage is empty after login |
| Reuse detection ends the session with the specific wording | Playwright against the mock's replay endpoint |
| A gated action states its reason and never reaches the network | Test asserting the control is `aria-disabled` and no request was captured |

**Unblocks:** M3.

### Gate 4 — the directory behaves like a shared surface (end of M3)

| What | Proven by |
|---|---|
| Every collection parameter survives a reload and a Back press | Playwright: filter, sort, page, reload, assert the view; then Back through the history |
| Changing a filter resets `page` to 1 | Unit test over the query-string helper |
| An invalid parameter falls back rather than erroring | `?page=-3&sort=nonsense` renders page 1, default sort |
| A refetch does not collapse the table | Test asserting rows stay mounted while a refetch is in flight |
| 304 and 409 are visible, not swallowed | Tests for both paths, plus the footer and the conflict panel |
| Every state the inventory lists for `users` and `users/:id` exists | Walked against the inventory, state by state |

**Unblocks:** M4.

### Gate 5 — the demo is coherent (end of M4)

| What | Proven by |
|---|---|
| Every request the session makes appears in the inspector | Test asserting captures equal requests, including pending ones |
| `Copy as curl` never contains a real token | Test asserting `$TOKEN` in the output |
| Zero accessibility violations on every route | `axe-core` in Playwright |
| The keyboard contract in section 4 of the inventory holds | Component tests, one per row of that table |
| The whole inventory is implemented or deferred by name | Inventory walked end to end; gaps listed in the PR Notes |

**Unblocks:** M5. Nothing touches the API repository before this gate closes.

### Gate 6 — the bridge, verified step by step

Ordered, each step proven before the next begins. This is where the two systems
are coupled, so a skipped check is expensive.

| # | Step | Proven by |
|---|---|---|
| 1 | Cookie pull request merged in the API | Its own tests green; `Set-Cookie` observed with all five attributes; the refresh token absent from the login body |
| 2 | The API's own loose ends closed in the same session | Branch protection, `ASPNETCORE_HTTPS_PORT`, seeding flag, package pins, and the telemetry decision written into its README |
| 3 | Console against the local API | By hand over `localhost`: login, reload, silent refresh, reuse detection, a 409 from two tabs, 403 on the demo account. CORS exercised against the real origin, not a dev proxy |
| 4 | Domain and DNS | `console.<domain>` and `api.<domain>` both resolve and serve TLS; the cookie is observed on a request from the console origin — the step that proves section 3.3 |
| 5 | The deployed pair | Playwright against the deployed API: the demo account's read-only boundary, a cold start, one full auth cycle |
| 6 | Presentation | README screenshots taken from the live site; ADR index complete; both repositories link to each other; the live URL opened in a clean browser profile |

**Exit:** `v1.0.0`.

---

## 9. Testing strategy

| Layer | Type | Tooling | What it covers |
|---|---|---|---|
| Tokens and helpers | Unit | Vitest | Contrast ratios, claim decoding, `curl` formatting, pagination parsing, query-string round trips |
| `ui/` primitives | Component | Vitest + RTL | Every state and variant, keyboard interaction, ARIA |
| Features | Component | Vitest + RTL + MSW | Behaviour against mocked HTTP, including every error status |
| Flows | End-to-end | Playwright + MSW | Login, refresh, search, mutate, conflict, inspect |
| Live | End-to-end | Playwright against the deployed API | The demo account's read-only boundary, cold start — M5 only |
| Accessibility | Automated | `axe-core` in Playwright | Every route, zero violations |

Rules:

- Test behaviour through the DOM as a user meets it. No assertions on component
  internals, no snapshot tests of markup.
- MSW rather than mocked modules, so the code under test makes real HTTP calls
  and the transport layer is exercised.
- Every bug fix starts with a failing test.
- Coverage is a diagnostic, not a target.
- Vitest counts each `test.each` row individually. State the expected number in
  chat before running.

---

## 10. Enforced invariants

Rules that are asserted rather than documented, following the same habit as the
API repository — where a promised architecture test turned out not to exist.

| Invariant | How |
|---|---|
| Text colours meet WCAG AA on their surface | Unit test over every approved pair; `Charcoal` and `Iron` are excluded from the text set by construction |
| `ui/` does not import from `features/` | ESLint `import/no-restricted-paths` |
| No feature imports another feature | Same rule, boundary per feature |
| The access token is never written to storage | Lint rule banning `localStorage` and `sessionStorage` outside an explicit allowlist |
| The generated schema matches the deployed document | CI regenerates and diffs |
| No manual memoisation if the compiler is on | Lint rule, decided in PR 1 |
| Status colour is never applied to an entity status | Lint rule restricting the status tokens to the inspector and response modules |

---

## 11. Definition of done

- [ ] Typecheck, lint, unit tests and build all pass
- [ ] New behaviour covered at the appropriate level
- [ ] Every state the inventory lists for the touched screen is implemented, or
      deferred with a named PR in the Notes
- [ ] Any mocked behaviour the PR relies on cites a line in
      `docs/OBSERVED-BEHAVIOUR.md`
- [ ] No design token used outside its documented role
- [ ] Every interactive element reachable and operable by keyboard, and focus is
      visible and correctly placed after every transition
- [ ] No `any`, no `@ts-expect-error` without a comment naming the reason
- [ ] The PR description explains why, not only what
- [ ] An ADR exists if the PR implements a decision

---

## 12. Open decisions

Recorded rather than resolved, because deciding them later is cheap and
deciding them wrong now is not.

| # | Question | Bearing |
|---|---|---|
| 1 | **A public landing page in front of the console.** One page, editorial density, explaining the project and linking into the demo. | The console is behind a login, so a reviewer arriving from a CV link currently meets a sign-in form and nothing else. A landing page is roughly one additional PR and is where the project is actually read. Decide before M4, since the app shell is shaped by whether `/` is a landing page or a redirect to `/users`. |
| 2 | **Whether `docs/SCREEN-INVENTORY.md` ships publicly.** | It is unusually thorough and reads well to a reviewer. It also makes any gap between the document and the build visible. Ship it only if the build matches it at `v1.0.0`. |
| 3 | **Light theme.** | Currently declined in the design decisions. Revisit only if a reviewer's environment forces it, which is unlikely for a demo opened deliberately. |

---

## 13. What this project is evidence of

Written down because it is the point, and because it should be checked against
reality at the end rather than assumed at the start.

- **React 19 and current tooling**, with the reasoning for each choice in an
  ADR: why the compiler instead of hand-memoisation, why declarative routing
  instead of a framework, why no state-management library.
- **A managed contract between two repositories.** Types generated from the
  running API, behaviour measured rather than assumed, drift caught by CI, the
  two systems joined in a milestone with its own tests. This is the answer to
  "why two repos".
- **Auth done properly in a browser.** Refresh token out of JavaScript's reach,
  access token in memory, single-flight refresh, permissions from claims.
- **An accessible design system built from tokens**, with contrast enforced by a
  test.
- **State modelled before it is coded** — an inventory of screens and states
  that the implementation is checked against, and collection state that lives in
  the URL where it belongs.
- **A frontend that makes a backend legible** — which is the argument for
  someone applying to backend roles.

---

## 14. What actually happened

Filled in as the project is built, in the same form as section 14 of the API's
build plan: where the finished repository differs from this document, and the
pull request that made the change.

| Where | Plan | What shipped |
|---|---|---|
| | | |
