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
when a stale second tab locks a user the first tab already locked, a 422 name the
field that failed, a 403 refuse a write from
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
| Runtime | Node | **24.19.0**, pinned in `.nvmrc` — section 14 |
| Package manager | pnpm | **12.4.2**, `packageManager` in `package.json`, installed globally with npm — section 14 |
| Language | TypeScript, `strict` | **5.9.3**, held below 6.1 by `typescript-eslint` — section 14 |
| Library | React 19 | **19.3.0**, released 9 September 2026 |
| Build | Vite | **8.3.0** — section 14 |
| Routing | React Router v8, **declarative mode** | **8.4.0**, installed in PR 4, ADR 0005 |
| Styling | Tailwind CSS v4, `@theme` | **4.3.3**. Token block comes from `docs/tokens.css` |
| Server state | TanStack Query | Pinned by the pull request that installs it, read from the registry then |
| URL state | `useSearchParams` | No third library; see section 5.3 |
| API types | `openapi-typescript` | Generated from the live `/openapi` document |
| API client | `openapi-fetch` | ~6 kB, typed, no generated classes |
| Mocking | MSW | Handlers typed from the same generated types |
| Fonts | Fontsource, `latin` + `latin-ext` | Self-hosted, no CDN |
| Unit / component tests | Vitest + React Testing Library | Vitest **5.0.1**, RTL **16.3.3** |
| End-to-end | Playwright | **1.63.0** |
| Accessibility | `axe-core` in Playwright, plus a contrast unit test | |
| Compiler | React Compiler | **Enabled** through `@vitejs/plugin-react` `compiler: true`. ADR 0002 |
| CI | GitHub Actions | |
| Hosting | Cloudflare Pages | Static, free, preview deploy per pull request |

**Versions.** The numbers above are the pins in `package.json` at the end of
M0, read from their registries in M-1 and PR 1 rather than remembered. Where they
differ from what this plan first proposed, section 14 says why. A package not yet
installed is pinned by the pull request that installs it, from the registry at
that moment — the same rule the API repository follows.

**React Compiler.** No longer experimental. Enabled, it makes manual `memo`,
`useMemo` and `useCallback` largely unnecessary, which is a decision about how
performance work is done in this codebase rather than a build flag. It belongs
in PR 1 with an ADR either way; what is not acceptable is enabling it and still
hand-memoising, or disabling it without saying why. Decided in PR 1: enabled,
ADR 0002.

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
| Node 24, pnpm installed globally with npm | Toolchain. Corepack was the plan; section 14 records why it is not used | M-1 |
| `docs/tokens.css` | The `@theme` block PR 1 imports. Written from `docs/DESIGN-DECISIONS.md`, sections 3, 4, 6 and 11 | PR 1 |
| The deployed API's `/openapi` document, read-only | Generates `schema.d.ts`; the API is already live and this changes nothing in it | PR 7 |
| **The API's observed behaviour, measured and written down** | See 3.4 | Gate 0, committed in PR 6 |
| **The auth contract frozen on paper** | See 3.2 | Before PR 8, the mock |

No secret is needed to develop or test. No domain is needed before M5.

### 3.2 The auth contract must be decided before it is mocked, not before it is merged

The refresh token moves from the JSON body into an `HttpOnly` cookie. That is a
change in the API repository, and it lands in M5. What cannot wait until M5 is
the *shape* of it, because MSW handlers written in M1 encode that shape and
every auth test asserts against it. A guess there means M5 is a redesign instead
of a connection.

So before PR 8 writes the mock, this table is fixed. ADR 0007 records it when
the login pull request implements it. Field names are the ones measured at Gate 0
(`docs/OBSERVED-BEHAVIOUR.md` rows 1, 6-8), so the mock and the API differ only
where M5 deliberately changes the API.

| Question | Decision |
|---|---|
| Cookie name | `umapi_rt` |
| Attributes | `HttpOnly`, `Secure`, host-only (no `Domain`), `SameSite=Strict`, `Path=/api/v1/auth` — decision 16: the path first frozen here, `/api/v1/auth/refresh`, would keep the cookie away from `/auth/logout`, which needs it to revoke the token |
| Set by | `POST /auth/login` and `POST /auth/refresh` |
| Cleared by | `POST /auth/logout`, and by the API when reuse is detected |
| Lifetime | `Max-Age` equal to the refresh token's remaining lifetime — 7 days today (observed row 3) — so closing the browser does not end the session. Decision 11; a session cookie was the alternative |
| Login response body | `accessToken` and `accessTokenExpiresAtUtc`, nothing else. `refreshToken` and `refreshTokenExpiresAtUtc` leave the body; the cookie carries both |
| Refresh response body | The same two fields as the login body |
| Refresh request body | Empty. The cookie is the credential. |
| Refresh with no cookie | 401, problem details, no hint about why |
| Reuse detected | 401 with `errorCode` `Auth.RefreshTokenReused`; every session of the account is revoked (observed rows 7-8) and the cookie is cleared |
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
- that replaying a superseded refresh token revokes sessions, and how many
- how long a cold start takes, and what a readiness probe against a stopped
  database returns

Every one of those is a state in `docs/SCREEN-INVENTORY.md`. If the mock
encodes what the API's README claims instead of what the deployed instance does,
then M2 and M3 are built on a document rather than a system, and M5 discovers it
too late to be cheap.

Gate 0 ran on 2026-09-23 and justified itself. Four measured behaviours differ
from what had been written: reuse detection revokes **every session of the
account**, not one chain; the ETags are **weak**, which matters for `If-Match`;
the API produces **three** problem-details shapes, not one; and production holds
**two users**. Each is now reflected in this plan, the inventory and the bridge
specification, and each is a row in `docs/OBSERVED-BEHAVIOUR.md`.

The API's source was then read at the same commit, and it settled what probing
could not (rows 43-55, marked as source-read): there is **no optimistic
concurrency on users** at all, so a stale write overwrites rather than conflicts;
two concurrent refreshes end in either a 409 or a reuse detection, depending on
timing; locking a user does not revoke their sessions; nothing stops an
administrator locking the only administrator; the refresh endpoint shares the
login's rate limit; and CORS exposes a fixed list of headers, which bounds what
the inspector can show.

The last three probes ran on 2026-09-25 and confirmed the source where it
mattered most: search matches one field at a time, so a full name finds no one;
two concurrent refreshes ended in a 409 with nothing revoked, three rounds out of
three; and an update answers 204 with no body, so the new `ETag` has to be read
again.

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
- a 429 on refresh read as **rate limiting, not as a lost session**. Refresh
  shares the `auth` budget of ten requests a minute per IP with login and logout
  (observed row 52); a reviewer reloading quickly can spend it, and signing them
  out for it would be wrong. Single-flight protects this budget too.
- the knowledge that a browser reads only the response headers CORS exposes
  (row 53). The inspector shows what it can read and says so; `X-Correlation-Id`
  is exposed in M5 step 1 (decision 15)
- an error reader that treats only `status` and `title` as guaranteed. The API
  answers in three problem-details shapes (observed row 34): `errorCode`,
  `detail` and `traceId` are each absent from at least one of them, and `errors`
  field keys are PascalCase while query parameters are camelCase, so field
  matching is case-insensitive

That last point is the single most common bug in hand-rolled auth clients: ten
parallel 401s producing ten refresh calls, nine of which rotate a token that
has already been rotated and trip the API's own reuse detection — which then
revokes every session of the account (observed rows 7-8), not only this tab's.
Single-flight is not an optimisation here; without it the feature is wrong.

### 4.5 Session and tokens

| | Where | Why |
|---|---|---|
| Access token | Memory only, in a provider | Never in `localStorage`; an XSS cannot read what is not stored |
| Refresh token | `HttpOnly` cookie set by the API | JavaScript cannot read it at all |
| Cookie attributes | Section 3.2 | Same-site because `console.` and `api.` share the registrable domain, so it is never a third-party cookie. `Strict` removes CSRF on that endpoint without a separate token. |
| Permissions | Decoded from the access token's `permission` claim, which is an array or, for a single permission, a string (observed row 4) | The UI reflects what the token allows, not what a role name implies, and not what a HATEOAS link offers — the API does not filter links (observed row 33) |
| Expiry | `exp - iat` (900 s today), counted from the moment the response arrived | The client clock is not trusted: the development machine ran two minutes ahead of the server (observed row 40). A server timestamp is never compared with `Date.now()` |
| Revocation | On `Auth.RefreshTokenReused` the session is cleared from memory at once | Access tokens are not checked against revocation and stay valid until `exp` (observed row 9), so waiting for the next 401 would leave a revoked session usable for up to fifteen minutes |

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
refresh with single-flight.

A visible **refresh race** — the API's reuse detection and its concurrency
token are the most interesting things in it. Once the refresh token lives in an
`HttpOnly` cookie the console never holds a superseded token, so it cannot replay
one. The demonstration therefore sends **two refreshes at once with the same
cookie**, deliberately bypassing single-flight (ADR 0008 is the reason not to).

The API refuses one of the two, and which refusal it gives depends on timing
(observed row 46, read from the source; probe 8b measures it live):

- **409 `Concurrency.Conflict`** — the loser tried to rotate a row the winner had
  just changed. Nothing is revoked; the winner's new cookie stands and the
  session carries on.
- **401 `Auth.RefreshTokenReused`** — the loser read the already-rotated token,
  which is indistinguishable from a stolen one. Every session of the account is
  revoked and the session ends with the reuse wording.

Both are correct refusals, and the screen presents whichever happened, with
both responses in the inspector, rather than promising one outcome (decision
13). Measured live, three rounds out of three were the 409 (observed row 11):
requests that leave together read the same row and collide on the write, while
the 401 needs the loser to read after the winner has committed. A visitor will
almost always see the first outcome; the second stays designed, and is exercised
against the mock. Because the demo account is shared, the second outcome signs out
every visitor using that account; the confirmation says so rather than hiding it
(decision 5).

### 6.2 User directory
Paginated table reading `X-Pagination`. Debounced search. Sorting on the
whitelisted fields, which the API does not reveal by probing — an unknown field
is ignored silently (observed row 17), so the whitelist comes from its contract.
Filtering by the four statuses the API accepts: Pending, Active, Locked,
Deactivated (observed row 18). All of it in the URL. Conditional GET:
the `ETag` is kept and sent back as `If-None-Match`, and a 304 is shown as a 304
rather than hidden.

Production holds two users (observed row 20). The directory is the screen the
project is judged on, and two rows demonstrate neither pagination nor search.
Realistic data is seeded into production in M5 step 2 (decision 7); until
then the mock's factories produce it.

Search compares one field at a time (observed row 56): `Petrović` finds Marko
Petrović, `Marko Petrović` finds no one. The console sends the term as typed,
and the `empty-search` state repeats it, so the reason is visible.

### 6.3 User detail and mutations
Role assignment, lock and unlock, profile update. Optimistic updates with
rollback.

An update answers **204 with no body** (observed row 57): the response carries
neither the saved record nor its new `ETag`. A successful save therefore reads
the detail again, so the concurrency panel and `updatedAtUtc` never show the
pre-save values.

**The API has no optimistic concurrency on users** (observed rows 26, 45): no
version, no `If-Match`, so a stale profile edit silently overwrites a newer one.
The console states that in the concurrency panel rather than implying a
protection that does not exist; the API does not gain one in v1 (decision 12).

What the API does answer with 409 are **domain conflicts** (row 49):
`User.AlreadyLocked`, `User.RoleAlreadyAssigned`, `User.EmailNotUnique`,
`User.AlreadyDeactivated`. A stale second tab produces them naturally — lock a
user in one tab, then lock it again in the other — and they are surfaced as a
real conflict with a "reload" affordance, not as a generic error toast. The
related refusals `User.NotLocked`, `User.LastRoleCannotBeRemoved` and
`User.RoleNotAssigned` are 400, and are rendered the same way.

Locking does not end the locked user's sessions at once: their refresh is
refused, so the session lapses within fifteen minutes (row 51). And nothing
stops an administrator locking the only administrator (row 50) — decision 14
adds the rule in M5 step 1.

### 6.4 Permission-driven UI
Route guards and action affordances derive from token claims. The published demo
account holds `users.read` and `roles.read` (observed row 4), so a visitor sees write actions
disabled with a reason naming the permission each one needs — `users.write` to
edit, `users.lock` to lock or unlock, `roles.manage` to assign or remove a role
(row 48) — then can sign in as an administrator and watch them
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

A bootstrap step, a measurement gate and six milestones, seventeen pull
requests — section 14 records why the count grew from fifteen. The numbers below
are the current ones. One branch per PR,
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

**Unblocks:** PR 1. **Done** — the repository's first commit is `930ffd3`.

### M0 — Foundation (5 PRs) — complete

| PR | Branch | Contents |
|---|---|---|
| 1 | `chore/scaffold` | Vite + React 19 + TS strict, pnpm pinned at the version read in M-1, ESLint and Prettier, Tailwind v4 importing `docs/tokens.css`, Vitest, path aliases. The four documents — `docs/BUILD-PLAN.md`, `docs/SCREEN-INVENTORY.md`, `docs/DESIGN-DECISIONS.md`, `docs/tokens.css` — plus an empty `docs/OBSERVED-BEHAVIOUR.md` with its column headers. React Compiler decision with its ADR. |
| 2 | `ci/build-and-test` | GitHub Actions: install, typecheck, lint, unit tests, build. Playwright installed and running one smoke spec. **Branch protection configured and verified: both checks required, enforcement active on the default branch, required approvals 0.** |
| 3 | `feat/design-primitives` | `ui/`: Button (ghost, destructive, disabled-with-reason), Input, Card, Badge, StatusDot, CodeWindow, Table shell, Dialog with focus trap. The contrast test. |
| 4 | `feat/specimen-route` | `/_design`, dev-only: every primitive in every state from the inventory, on one page. The route the design is reviewed on for the rest of the project. |
| 5 | — | Inserted: keeps the specimen page inside a narrow viewport. Found in the PR 4 browser review. |

**Exit:** Gate 1 in section 8. Closed 2026-09-23 at `7c2463c`.

### Gate 0 — Measurement (1 PR)

| PR | Branch | Contents |
|---|---|---|
| 6 | `docs/observed-behaviour` | `docs/OBSERVED-BEHAVIOUR.md` filled in from the probes. In the same pull request, every document a measurement contradicted is edited: this plan, `docs/SCREEN-INVENTORY.md`, `docs/DESIGN-DECISIONS.md`. No code. |

**Exit:** Gate 0 in section 8.

### M1 — Contract and mocks (2 PRs)

| PR | Branch | Contents |
|---|---|---|
| 7 | `feat/api-types` | `openapi-typescript` generation from the deployed document, committed output, a drift check in CI, the `openapi-fetch` client with `credentials: 'include'`. |
| 8 | `feat/msw-handlers` | MSW handlers typed from the generated schema, plus factories producing realistic data — about 130 users with `latin-ext` names across all four statuses. The whole surface including 304, 401, 403, 409, 413, 422, 429, 503, the three problem-details shapes, account-wide revocation on reuse, both outcomes of two concurrent refreshes (409 with nothing revoked, 401 with everything revoked) selectable per test, domain 409s and 400s with their `errorCode`s, last-write-wins on update, and a settable cold-start delay — each behaviour matching a line in `docs/OBSERVED-BEHAVIOUR.md`. The cookie contract from section 3.2 implemented in the mock. |

**Exit:** Gate 2.

### M2 — Authentication (3 PRs)

| PR | Branch | Contents |
|---|---|---|
| 9 | `feat/login` | Login route, form with 422 field errors, session provider, access token in memory, the `boot` screen. |
| 10 | `feat/silent-refresh` | Refresh on 401 with single-flight queueing, reload rehydration without a login flash, logout. |
| 11 | `feat/permission-gates` | Claim decoding (`string` or array), route guards, action gating with a stated reason, the session screen with its skew-proof expiry countdown, and the reuse-detection demonstration. |

**Exit:** Gate 3.

### M3 — The directory (3 PRs)

| PR | Branch | Contents |
|---|---|---|
| 12 | `feat/user-list` | Table, pagination from `X-Pagination`, debounced search, sorting, status filter — **all of it in the query string** — plus the empty, loading and error states from the inventory. |
| 13 | `feat/user-detail` | Detail route, profile update, role assignment dialog, lock/unlock, optimistic updates with rollback. |
| 14 | `feat/conditional-get` | `ETag` retention, `If-None-Match`, 304 handling, and the 409 conflict path made explicit. |

**Exit:** Gate 4.

### M4 — The inspector and the shell (2 PRs)

| PR | Branch | Contents |
|---|---|---|
| 15 | `feat/inspector` | Capture store, dockable panel, status dots, request/response rendering, copy as `curl`. |
| 16 | `feat/app-shell` | Navigation, the editorial sign-in screen at display type sizes, cold-start handling, the 404 route, the error boundary, the narrow-viewport layout. |

**Exit:** Gate 5.

### M5 — The bridge (1 PR here, 1 PR in the API, then manual)

This is the milestone where the two repositories meet. It is ordered, and each
step is verified before the next begins — Gate 6.

| Step | Where | Contents |
|---|---|---|
| 1 | `UserManagementAPI` | The cookie pull request: refresh token moves from the response body to the `HttpOnly` cookie of section 3.2, `POST /auth/refresh` reads it, `POST /auth/logout` clears it, reuse detection clears it. The reuse check made atomic if probe 8b shows a race. CORS given the exact console origin with `AllowCredentials`. Its own tests. Bridge specification, section 3. |
| 2 | `UserManagementAPI` and Render | Every item on the API repository's list of unverified claims closed or deferred by name; the API's documentation corrected where Gate 0 contradicted it; realistic data seeded into production once. Bridge specification section 4. |
| 3 | Local | Console pointed at the local API over `localhost`, no dev proxy. Full flow verified by hand. |
| 4 | Infrastructure | Domain registered. `console.<domain>` → Cloudflare Pages, `api.<domain>` → Render. `ASPNETCORE_HTTPS_PORT` and the CORS origin updated in the Render dashboard, which does not read `render.yaml`. |
| 5 | The deployed pair | The live Playwright suite in `e2e/live/`, run on demand. |
| 6 | `umapi-console` PR 17, `docs/release-1.0` | The live suite from step 5 committed, accessibility pass, README with the architecture diagram, screenshots and the demo credentials, the ADR index, cross-links to the API repository. |

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

**Before M1; its results are PR 6.** Results go into
`docs/OBSERVED-BEHAVIOUR.md`, one numbered row per behaviour: request, response,
date. The probe procedure with its exact commands is kept outside the repository;
this table is what each probe decides.

**Status, 2026-09-25:** every probe run except 10a, deferred to PR 7, which
reads the OpenAPI document regardless. Probes 1-9 on 2026-09-23; 5b, 8b and 10b
on 2026-09-25 (rows 11, 25, 56-58). The API's source read on 2026-09-23 (rows
43-55). Decisions 4-16 taken. The gate closes when PR 6 merges.

Run in this order, because each depends on the one before:

| # | What | Proven by | If it differs from the README |
|---|---|---|---|
| 1 | Login works and returns a usable access token | `POST /api/v1/auth/login` with the demo account | Everything below is blocked; fix first |
| 2 | Cold start and readiness | First request after an idle period, timed; readiness with the database down | The `cold-start` copy and its 1200 ms threshold are retuned |
| 3 | `X-Pagination` contents and page-size clamp | `GET /api/v1/users?pageSize=500`, read the header | `lib/api/pagination.ts` and the directory footer follow the header, not the guess |
| 4 | Conditional GET | Take the `ETag`, repeat with `If-None-Match`; then write and re-read | A 304 that never arrives makes PR 14 a different PR |
| 5 | Sorting and filtering | `orderBy=email desc`; an unknown sort field; an unknown status | Decides whether the toolbar disables a control or shows a 422 |
| 5b | Search | `searchTerm` against the live instance: case-insensitivity, and which fields match. The source says email, first and last name, not diacritic-insensitive (row 43) | Confirms the directory's `q` mapping and the `empty-search` state |
| 6 | Demo account boundary | `POST /api/v1/users` as demo → expect 403 | The `gated` state's reason text comes from the real claim set |
| 7 | Rate limiting | Eleven logins in a minute; read `Retry-After` | The countdown in `rate-limited` uses the real header, or a fallback |
| 8 | **Refresh rotation and reuse detection** | Log in, refresh, replay the **old** refresh token | **The one that can change the plan.** It did: revocation is account-wide, and the demonstration had to be redesigned — section 6.1 |
| 8b | Two concurrent refreshes with one token | Two requests sent together, three rounds, then the winner's token | Expected from the source: one 200, and a 409 or a 401 reuse (row 46). How often each occurs decides how section 6.1's screen is worded. Both 200 would be an API defect, fixed in M5 step 1 |
| 9 | Versioning, HATEOAS, body limit, security headers | `/api/v2/users/{id}`, the vendor media type, an oversized body on an anonymous endpoint, response headers | Affects what the inspector has to render, not whether it works |
| 10a | The OpenAPI document | Optional since the source was read (rows 43-55); PR 7 reads the document regardless | Confirms the source-read rows |
| 10b | Writes as administrator | ETag before and after a reversible edit of the demo user; assigning the demo user a role it already holds, for a domain 409 that changes nothing | Confirms rows 25 and 49 for PR 8's 409 handler. The administrator password is never recorded anywhere. Refusals whose failure would lock the only administrator are **not** probed in production; they are read from the API's tests in M5 |

**Unblocks:** PR 6, then M1.

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
| The design is reviewable | `/_design` renders every primitive in every state; reviewed in the browser at both densities. **Outstanding:** the page at 380px after PR 5, which merged without that browser check |

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
| The refresh race renders both outcomes | Playwright against the mock, once per outcome: the 401 ends the session with the reuse wording and the access token is gone from memory at once; the 409 leaves the session running and says why |
| A 429 on refresh keeps the session | Test: refresh answered 429 shows `rate-limited`, and the user is still signed in when it clears |
| Expiry display ignores the client clock | A unit test with the clock skewed by ten minutes shows the same remaining time |
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
| 422 field errors land on their field whatever the key casing | Test with the API's PascalCase `errors` keys |
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
| 1 | Cookie pull request merged in the API | Its own tests green; `Set-Cookie` observed with every attribute of section 3.2; both refresh fields absent from the login body; two concurrent refreshes produce exactly one 200 |
| 2 | The API's own loose ends closed in the same session | Every item on the API repository's list of unverified claims ticked with its proof or deferred by name; the API's README and ADRs say what Gate 0 measured; production holds the seeded data and the demo account is still refused a write |
| 3 | Console against the local API | By hand over `localhost`: login, reload, silent refresh, the refresh race, a domain 409 from a stale second tab, 403 on the demo account, and the self-lock guard if decision 14 added it. CORS exercised against the real origin, not a dev proxy |
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

Raised by Gate 0 on 2026-09-23 and decided on 2026-09-25, each as it was
proposed. The argument is kept as it was made; overturning one later is a local
edit, listed in the Bearing column.

| # | Question | Decided | Bearing |
|---|---|---|---|
| 4 | **Cold-start copy.** Measured 32-34 s warm-database, 56 s with the database down; the copy promised 30. | *"…this can take up to a minute."* Threshold stays 1200 ms. | Inventory §2.1 |
| 5 | **The reuse demonstration on the shared demo account.** It signs out every visitor using that account. | Allowed, with the consequence stated in the confirmation. Gating it behind `users.write` would hide the project's best demonstration from every reviewer. | Inventory §3.9, section 6.1 |
| 6 | **Probe 8b before PR 6.** | Yes. It decides whether the demonstration is possible at all. Run 2026-09-25. | Observed row 11 |
| 7 | **Realistic data in production.** Two users today. | About 130 synthetic users with `latin-ext` names across all four statuses, seeded once in M5 step 2, never by `SeedOnStartup`. | Bridge specification section 4 |
| 8 | **How `Deactivated` renders.** | Ash gray with its own glyph, the pattern Locked already uses: both are states with consequences. | Design decisions §10, inventory §3.3 |
| 9 | **The administrator account for probe 10.** | Used; the password is never recorded. Run 2026-09-25. | Observed rows 25, 57, 58 |
| 10 | **Numbering of the Gate 0 pull request.** | PR 6, seventeen in total. Applied throughout this document. | Section 7, inventory §6, README-FIRST §6 |
| 11 | **The refresh cookie's lifetime.** | `Max-Age` equal to the refresh token's lifetime, so a browser restart keeps the session. | Section 3.2, bridge specification section 2 |

Raised by reading the API's source on 2026-09-23 (observed rows 43-55), and
decided on 2026-09-25 as proposed.

| # | Question | Decided | Bearing |
|---|---|---|---|
| 12 | **Optimistic concurrency on users.** The API has none; a stale edit overwrites. | Not in v1. The console says so in the concurrency panel, and the API's README says so. Adding it properly means a version the client sends back — the ETag cannot serve, because the edge weakens it (row 22). Recorded as a candidate for after `v1.0.0`. | Section 6.3, inventory §3.4 |
| 13 | **The refresh race has two outcomes.** | The screen presents whichever occurred, both responses in the inspector. No attempt to force one. Live, the 409 is the one seen (row 11). | Section 6.1, inventory §3.9 |
| 14 | **Nothing stops locking the only administrator.** | The API refuses locking yourself — one domain rule, one test, in M5 step 1. It protects production from a single mis-click. | Bridge specification section 3, inventory §3.6 |
| 15 | **`X-Correlation-Id` is not readable by the browser.** | Exposed through CORS in M5 step 1, so the inspector can show the id a log line carries. `WWW-Authenticate` stays unexposed; `errorCode` already says more. | Section 4.4, inventory §3.8 |
| 16 | **The cookie's `Path`.** Frozen as `/api/v1/auth/refresh`, which the browser would not send to `/api/v1/auth/logout` — and logout revokes by the token it is given (observed row 54). | `Path=/api/v1/auth`: sent to login, refresh and logout, still never to a user or role request, so `SameSite=Strict` keeps its argument. | Section 3.2, bridge specification section 2 |

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
| §2 Runtime | Node 22 LTS | Node 24.19.0. Node 22 has left active LTS. PR 1. |
| §2 Build | Vite 7, "required by React Router v8" | Vite 8.3.0. The claim is wrong in both halves: `react-router@8.4.0` declares a peer on `react >=19.2.7` only and does not constrain Vite. PR 1. |
| §2 Language | TypeScript, latest | TypeScript 5.9.3. The registry's `latest` is 7.0.2, but `typescript-eslint` 8.70.0 declares a peer range of `<6.1.0`. PR 1. |
| §2 Compiler | React Compiler through `babel-plugin-react-compiler` | `@vitejs/plugin-react` with `compiler: true`. Plugin v6 moved from Babel to an oxc transform; `oxc-transform-react` is pinned at 0.145.0, the only release inside the plugin's declared peer range. PR 1. |
| §3.1 Toolchain | pnpm through `corepack enable` | pnpm installed globally with npm, on the development machine and on the runner. The corepack bundled with Node 24 does not resolve pnpm 12's bin layout. PR 1, PR 2. |
| §10 Invariant | "No manual memoisation" as a lint rule | A grep in the verification block. The rule that would express it was not verified to exist at the pinned plugin version; ADR 0002 records that plainly. PR 1. |
| §10 Invariant | `import/no-restricted-paths` | `no-restricted-imports` with path patterns, arriving in PR 3. No import-resolver plugin is installed, and adding one for this rule alone is equipment that outweighs the job. PR 1. |
| §9 Testing | One test command | Two, because they are two runners: `pnpm test:run` over `src/**/*.test.{ts,tsx}` and `pnpm test:e2e` over `e2e/`. Vitest's default include would otherwise have collected the Playwright specs. PR 2. |
| §7 PR 2 | "one smoke spec" | The spec runs against the production bundle over `vite preview` rather than the dev server, so CI exercises what is deployed. PR 2. |
| DESIGN-DECISIONS §1 | Inter / Playfair Display / JetBrains Mono | The Fontsource variable packages declare `Inter Variable`, `Playfair Display Variable` and `JetBrains Mono Variable`. The stacks lead with those and keep the static names as fallbacks. As written the fonts would have loaded and nothing would have used them. PR 3. |
| DESIGN-DECISIONS §1 | "The subset must include `latin-ext`" | Satisfied automatically: the variable packages ship no per-subset stylesheet, and the entry point declares every subset with its own `unicode-range`. Verified in the browser. PR 3. |
| DESIGN-DECISIONS §3 | Twelve colours tabulated | `--color-sky-blue`, carried by `--color-status-3xx`, was never measured. It is 9.99:1 on the canvas and is now in the test. PR 3. |
| DESIGN-DECISIONS §10 | Status tokens restricted to the inspector | The allowlist is `src/ui/StatusDot.tsx` plus the inspector. As written the rule forbade the status mapping to the one component whose job is to carry it. PR 3. |
| DESIGN-DECISIONS §11 | `tokens.ts` holds the permission sets | It holds only token names. The test resolves each name against the stylesheet, so no colour value exists in two places. PR 3. |
| §10 Invariant | Status-colour invariant enforced | The grep matched `--color-status-`, which components never contain. It matches the generated Tailwind classes as well. PR 3. |
| §10 Invariant | Tier-1 tokens never referenced by components | The grep that asserts it did not exist until PR 3. |
| README-FIRST §6 | ADR 0004 in PR 1 | Written in PR 3, which is where the decision is implemented and enforced. |
| Protocol §4 | One apply script per PR | PR 2 took three, PR 3 took five, PR 4 took one. One squashed commit per PR either way. |
| §2 Routing | React Router v8 arriving with authentication | Installed in PR 4. `/_design` is described as a route, and the login pull request (now PR 9) then adds routes to a router that exists rather than introducing routing and authentication together. ADR 0005. PR 4. |
| §4.2 Folder layout | `app/` holds the router, providers, error boundaries and the app shell | It also holds `app/design/`, the specimen page. It is not a feature and it does not ship, so `features/` would be the wrong home. PR 4. |
| DESIGN-DECISIONS §11 | "A screen belongs to one density for its whole life" | `/_design` renders both densities on one page. It is the only exception, and it exists so the two can be compared at all. PR 4. |
| §7 Milestones | Fifteen pull requests | Sixteen. PR 5 fixes the specimen page below roughly 480px, found in the PR 4 browser review: three CodeWindow instances pinned at `w-96`, two tables with no overflow container, and 64px of page padding at every width. Every later pull request shifts by one. |
| §7 Milestones | Sixteen pull requests | Seventeen. Gate 0's results are committed as PR 6, so everything after it shifts by one more. Sections 7 and 8, the inventory's section 6 and README-FIRST carry the current numbers; rows above this one keep the numbers in force when they were written. PR 6. |
| §8 Gate 0 | Nine probes | Thirteen: 5b (search), 8b (concurrent refresh), 10a (the OpenAPI document) and 10b (writes as administrator) added. Probe 2 ran first, while the instance was still idle. Probe 7 used an unknown email, so a lockout policy could not lock the public account. Probe 9 measured the body limit on `/auth/login`, because on a write authorisation answers before the body is read. PR 6. |
| §3.2 Contract | Login body: "access token, expiry" | Field names measured: `accessToken`, `accessTokenExpiresAtUtc`. Both refresh fields leave the body. The refresh response has the same shape. `Max-Age` proposed. PR 6. |
| §4.5, §6.1 | Reuse revokes "the whole chain" | It revokes every session of the account, and access tokens survive until `exp`. The session clears itself on `Auth.RefreshTokenReused`. PR 6. |
| §6.1 | The demonstration replays a superseded token | It sends two concurrent refreshes. A browser that holds the refresh token only in an `HttpOnly` cookie never has a superseded one to replay. PR 6. |
| §4.4 | One error shape | Three. Only `status` and `title` are relied on. PR 6. |
| §4.5 | Expiry read from the token | Counted from `exp - iat`, because the client clock cannot be trusted. PR 6. |
| §6.2 | The directory demonstrated on the API's data | Production holds two users; seeding planned for M5. PR 6. |
| DESIGN-DECISIONS §10, inventory §3.3 | Three entity statuses | Four: `Deactivated`. PR 6. |
| §7 M5 | Four steps | Six, aligned with the bridge specification and Gate 6, which already had six. PR 6. |
| §1, §6.3 | A 409 when two tabs race on the same record | The API has no optimistic concurrency on users (source). 409 comes from domain conflicts a stale tab produces; profile edits are last-write-wins, stated on screen. PR 6. |
| §6.1 | Two concurrent refreshes always end in reuse detection | Either a 409 with nothing revoked or a 401 with everything revoked, by timing (source). The screen presents whichever occurred. PR 6. |
| §3.2 Contract | `Path=/api/v1/auth/refresh` | `Path=/api/v1/auth` proposed: logout needs the cookie too. Open decision 16. PR 6. |
| §4.4 | Every 401/429 on refresh ends the session | A 429 on refresh is rate limiting: refresh shares the IP-keyed `auth` budget with login and logout (source). PR 6. |
| §8 Gate 0 | Probe 10a reads the OpenAPI document | Optional. The API's source answered the same questions; its facts are rows 43-55, marked as read rather than measured. Deferred to PR 7, which reads the document regardless. PR 6. |
| §6.3 | An optimistic update settles on the response | An update answers 204 with no body; a successful save reads the detail again for its new `ETag`. PR 6. |
| §6.2 | Search as a single match | Search compares one field at a time; a full name finds no one (observed row 56). Stated in the inventory; the term is sent as typed. PR 6. |
| §6.1 | Two outcomes of the refresh race, equally likely | Three rounds out of three were the 409 live (observed row 11). The 401 stays designed and mocked. PR 6. |
