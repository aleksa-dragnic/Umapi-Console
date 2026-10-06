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
| Server state | TanStack Query | **5.103.2**, installed in PR 12, ADR 0010. 5.104.0 was a day old and needed a release-age exclusion — section 14 |
| URL state | `useSearchParams` | No third library; see section 5.3 |
| API types | `openapi-typescript` | **7.13.0**, generated from the deployed `/openapi/v1.json` — ADR 0006 |
| API client | `openapi-fetch` | **0.17.0**. ~6 kB, typed, no generated classes |
| Mocking | MSW | **2.15.0**. Handlers typed from the same generated types; `src/lib/testing/` |
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
| The deployed API's `/openapi/v1.json` document, read-only | Generates `schema.d.ts`; the API is already live and this changes nothing in it | PR 7 |
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
| Cleared by | `POST /auth/logout`, and by the API whenever it refuses a refresh that carried a cookie - reuse, an unknown, revoked or expired token, a locked or deactivated account. Never by a 409: a lost race's answer can land after the winner's new cookie (API ADR 0019, observed row 70) |
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
│   │   └── inspector/    Request/response rendering, copy as curl
│   ├── lib/
│   │   ├── api/          Generated types, openapi-fetch client, middleware,
│   │   │                 the transport and the request record (ADR 0014)
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

Types are generated from the deployed OpenAPI document
(`/openapi/v1.json`, observed row 59) into `src/lib/api/schema.d.ts`,
committed, and regenerated by `pnpm api:generate`. A `contract` job in CI
regenerates it on every pull request, every push to `main` and weekly, and
fails if the result differs from what is committed — so a backend change that
breaks the contract turns a check red, visibly, instead of failing at runtime in
front of a reviewer. It is not a required check: the document lives on a free
instance that sleeps and can be down, and a merge does not wait on it (ADR
0006).

The types describe what the document says, which is less than the instance
does (rows 60-63): statuses it does not list and problem-details fields it
omits are handled from `docs/OBSERVED-BEHAVIOUR.md`, never from the types.
Query parameters are sent under the document's PascalCase names (row 64).

`openapi-fetch` wraps it with one client instance, `src/lib/api/client.ts`,
whose base URL is the API origin alone — the generated paths already carry
`/api/v1` — from `VITE_API_BASE_URL`, defaulting to the deployed instance. Its
`fetch` is looked up per request, so a mock layer installed after the client
exists still sees every call. It carries:

- the access token from memory, as an `Authorization` header
- `credentials: 'include'`, so the refresh cookie travels
- a transport that records every request and its response for the inspector:
  method, URL, the headers the page can read, bodies to 64 kB, timing, with
  every credential replaced by a placeholder as it is recorded (ADR 0014)
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
rather than hidden. The validator is kept in the cache entry beside the data it
validates, and the browser's own HTTP cache is bypassed, because the API's
`private, no-cache` would let the browser revalidate on its own and hand the
console a 200 for a 304 (ADR 0013).

Production held two users (observed row 20). The directory is the screen the
project is judged on, and two rows demonstrate neither pagination nor search.
M5 step 2 seeded it once (decision 7): 132 users since 2026-10-03 (row 67); the
mock's factories produce a directory of the same kind.

Search compared one field at a time at Gate 0 (row 56). Since the API's #56 it
folds case and diacritics and matches the full name, first and last joined by a
space (rows 67, 73): `Marko Petrović` finds Marko Petrović, `Petrović Marko`
finds no one, and `djordjevic` finds no Đorđević. The console sends the term as
typed, and the `empty-search` state repeats it, so the reason is visible.

### 6.3 User detail and mutations
Role assignment and removal, lock and unlock, profile update. Optimistic updates
with rollback.

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
`User.EmailNotUnique` is the exception: a 409, but the record did not change and
a reload would not help, so its `detail` lands on the email field like a 422.

Locking does not end the locked user's sessions at once: their refresh is
refused, so the session lapses within fifteen minutes (row 51). Since the
API's #50, decision 14, an administrator cannot lock their own account (row
72), which also keeps the only administrator from locking themselves; no rule
stops one administrator locking another (row 50).

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

### M2 — Authentication (3 PRs) — complete

| PR | Branch | Contents |
|---|---|---|
| 9 | `feat/login` | Login route, form with 422 field errors, session provider, access token in memory, the `boot` screen. |
| 10 | `feat/silent-refresh` | Refresh on 401 with single-flight queueing, reload rehydration without a login flash, logout. |
| 11 | `feat/permission-gates` | Claim decoding (`string` or array), route guards, action gating with a stated reason, the session screen with its skew-proof expiry countdown, and the reuse-detection demonstration. |

**Exit:** Gate 3. Closed 2026-09-26 with PR 11.

### M3 — The directory (3 PRs) — complete

| PR | Branch | Contents |
|---|---|---|
| 12 | `feat/user-list` | Table, pagination from `X-Pagination`, debounced search, sorting, status filter — **all of it in the query string** — plus the empty, loading and error states from the inventory. |
| 13 | `feat/user-detail` | Detail route, row activation and keyboard traversal in the directory, profile update, role assignment and removal dialogs, lock/unlock, optimistic updates with rollback, and the domain conflicts (409) and refusals (400) they meet. |
| 14 | `feat/conditional-get` | `ETag` retention, `If-None-Match`, 304 handling. |

**Exit:** Gate 4. Closed 2026-09-27 with PR 14.

### M4 — The inspector and the shell (2 PRs) — complete

| PR | Branch | Contents |
|---|---|---|
| 15 | `feat/inspector` | Capture store, dockable panel, status dots, request/response rendering, copy as `curl`. |
| 16 | `feat/app-shell` | Navigation, the editorial sign-in screen at display type sizes, cold-start handling, the 404 route, the error boundary, the narrow-viewport layout, and the read-only `roles` screen (decision 17). `/` redirects to `/users` (decision 1). |

After PR 16, two pull requests the plan does not count come before its PR 17:
the directory fix of section 14 as GitHub #17, and the format fix as its own
pull request (decision 18), GitHub #18. M5 step 3 adds console pull requests of
its own before PR 17 (section 14), so the plan's PR 17 takes the next GitHub
number after them.

**Exit:** Gate 5.

### M5 — The bridge (pull requests on both sides, then manual)

This is the milestone where the two repositories meet. It is ordered, and each
step is verified before the next begins — Gate 6.

| Step | Where | Contents |
|---|---|---|
| 1 | `UserManagementAPI` | The cookie pull request: refresh token moves from the response body to the `HttpOnly` cookie of section 3.2, `POST /auth/refresh` reads it, `POST /auth/logout` clears it, reuse detection clears it. The reuse check made atomic if probe 8b shows a race. CORS given the exact console origin with `AllowCredentials`. Its own tests. Bridge specification, section 3. |
| 2 | `UserManagementAPI` and Render | Every item on the API repository's list of unverified claims closed or deferred by name; the API's documentation corrected where Gate 0 contradicted it; realistic data seeded into production once. Bridge specification section 4. |
| 3 | Local | First the mock brought to the API's M5 behaviour and the types regenerated from the deployed document, then the API's CORS for the dev origin. Console pointed at the local API over `localhost`, no dev proxy. Full flow verified by hand. |
| 4 | Infrastructure | Domain registered. `console.<domain>` → Cloudflare Pages, `api.<domain>` → Render. `ASPNETCORE_HTTPS_PORT` and the CORS origin updated in the Render dashboard, which does not read `render.yaml`. |
| 5 | The deployed pair | The live Playwright suite in `e2e/live/`, run on demand, and bridge §5's check 5 by hand: the demo account, which the local database of step 3 does not have (row 80). |
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

**Status, 2026-09-25:** every probe run; 10a as the first step of PR 7 (rows
59-64). Probes 1-9 on 2026-09-23; 5b, 8b and 10b
on 2026-09-25 (rows 11, 25, 56-58). The API's source read on 2026-09-23 (rows
43-55). Decisions 4-16 taken. Closed 2026-09-25 at `fa7c60c`.

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
| Generated types match the deployed document | The `contract` job fails when `schema.d.ts` is edited by hand, or when the document changes |
| Every mocked behaviour has a measured source | Each handler branch cites a line in `docs/OBSERVED-BEHAVIOUR.md` |
| The application runs with the API switched off | Dev server and the full test suite pass with no network access to the API |
| The cookie contract is implemented in the mock | A refresh with no cookie is a 401; with the cookie, a 200 |

**Unblocks:** M2. This is the most important gate in the project: everything
from here to M5 is written against this mock, so a wrong mock is a wrong
application that passes all of its tests.

**How PR 8 meets it.** The handlers live in `src/lib/testing/handlers/`, and
each branch cites its row; a branch the instance was never measured doing says
"not measured" instead, so the gaps are searchable. Vitest runs every test
against the node server with unhandled requests failing the test
(`src/setupTests.ts`); the dev server starts the browser worker before the first
render unless `VITE_API_MODE=live`, and a production bundle contains neither.
`src/lib/testing/auth.test.ts` asserts the cookie contract, including the two
refresh outcomes selectable with `setRefreshRace`.

MSW keeps the cookies a mocked response sets in its own jar. That jar honours
`Path` and `Max-Age` but not `credentials`, and it is not reachable from a test.
The mock therefore reads only the cookie's value, and `resetMock` clears it the
way the contract does — through a logout. Whether a browser sends the cookie is
proven in M5, against the real API, not here.

### Gate 3 — auth is correct, not merely working (end of M2)

| What | Proven by |
|---|---|
| A reload of a deep route never flashes the sign-in screen | Playwright: authenticated, reload `/users/<id>`, reached by opening the row, assert the sign-in form never mounts (`e2e/session.spec.ts`; on `/?view=reload` until PR 13, section 14) |
| Ten parallel 401s produce exactly one refresh | A test counting refresh calls while firing concurrent requests (`src/lib/api/refresh.test.ts`, ADR 0008) |
| The access token is never written to storage | The lint rule, plus a test asserting that no storage entry contains the token after login. Not "storage is empty": the mock keeps its cookie jar in `localStorage` (section 14, PR 9) |
| The refresh race renders both outcomes | Playwright against the mock, once per outcome (`e2e/race.spec.ts`): the 401 ends the session with the reuse wording, the 409 leaves the session running and says why. That the access token is gone from memory at once, and that the winner's 200 cannot bring it back, is a unit test (`src/features/auth/race.test.ts`): memory is not visible to a browser test (section 14) |
| A 429 on refresh keeps the session | Test: refresh answered 429 shows `rate-limited`, and the user is still signed in when it clears |
| Expiry display ignores the client clock | A unit test with the clock skewed by ten minutes shows the same remaining time (`src/features/auth/SessionScreen.test.tsx`: the server's clock ten minutes behind when the token is issued, the client's jumping ten minutes forward after it arrives) |
| A gated action states its reason and never reaches the network | Test asserting the control is `aria-disabled` and no request was captured (`src/features/auth/gated-action.test.tsx` on the lock action through `useCan`, and on every write of the real screen in `src/features/users/DetailScreen.test.tsx` and `e2e/detail.spec.ts`, section 14) |

**Unblocks:** M3.

### Gate 4 — the directory behaves like a shared surface (end of M3)

| What | Proven by |
|---|---|
| Every collection parameter survives a reload and a Back press | Playwright: filter, sort, page, reload, assert the view; then Back through the history (`e2e/directory.spec.ts`) |
| Changing a filter resets `page` to 1 | Unit test over the query-string helper (`src/features/users/url-state.test.ts`) |
| An invalid parameter falls back rather than erroring | `?page=-3&sort=nonsense` renders page 1, default sort (`src/features/users/DirectoryScreen.test.tsx`) |
| A refetch does not collapse the table | Test asserting rows stay mounted while a refetch is in flight (`loading-refetch` in the same file) |
| 304 and 409 are visible, not swallowed | Tests for both paths, plus the footer and the conflict panel: the 409 in PR 13 (`DetailScreen.test.tsx`), the 304 in PR 14 (the directory's footer and the detail's concurrency panel, unit and Playwright) |
| 422 field errors land on their field whatever the key casing | Test with the API's PascalCase `errors` keys (`DetailScreen.test.tsx`, `invalid`) |
| Every state the inventory lists for `users` and `users/:id` exists | Walked against the inventory, state by state, in the browser review of PR 13 and PR 14 |

Closed 2026-09-27 with PR 14.

**Unblocks:** M4.

### Gate 5 — the demo is coherent (end of M4)

| What | Proven by |
|---|---|
| Every request the session makes appears in the inspector | Test asserting captures equal requests, including pending ones |
| `Copy as curl` never contains a real token | Test asserting `$TOKEN` in the output |
| Zero accessibility violations on every route | `axe-core` in Playwright |
| The keyboard contract in section 4 of the inventory holds | Component tests, one per row of that table |
| The whole inventory is implemented or deferred by name | Inventory walked end to end; gaps listed in the PR Notes |

**Status, 2026-09-27: closed.** The first two rows were proven in PR 15:
`src/lib/api/capture.test.ts` counts what crossed the network against the
record, the silent refresh's replay included, and shows a request pending
before it settles; `src/features/inspector/curl.test.ts` and
`e2e/inspector.spec.ts` find `$TOKEN` and no token. The other three in PR 16:
`e2e/a11y.spec.ts` runs `@axe-core/playwright` 4.13.0 against WCAG 2.1 A and AA
on sign-in, `404`, the directory, a detail, roles, session, the inspector open
and a dialog open, and finds nothing - it does find an image without `alt` when
one is planted; inventory section 4 names the test for each of its rows; and the
inventory walk is in PR 16's Notes.

**Unblocks:** M5. Nothing touches the API repository before this gate closes.

### Gate 6 — the bridge, verified step by step

Ordered, each step proven before the next begins. This is where the two systems
are coupled, so a skipped check is expensive.

| # | Step | Proven by |
|---|---|---|
| 1 | Cookie pull request merged in the API | Its own tests green; `Set-Cookie` observed with every attribute of section 3.2; both refresh fields absent from the login body; two concurrent refreshes produce exactly one 200 |
| 2 | The API's own loose ends closed in the same session | Every item on the API repository's list of unverified claims ticked with its proof or deferred by name; the API's README and ADRs say what Gate 0 measured; production holds the seeded data and the demo account is still refused a write |
| 3 | Console against the local API | By hand over `localhost`: login, reload, silent refresh, the refresh race, a domain 409 from a stale second tab, and the self-lock guard (row 72). CORS exercised against the real origin, not a dev proxy. The demo account's 403 moved to row 5: the local database has none (row 80) |
| 4 | Domain and DNS | `console.<domain>` and `api.<domain>` both resolve and serve TLS; the cookie is observed on a request from the console origin — the step that proves section 3.3 |
| 5 | The deployed pair | Playwright against the deployed API: the demo account's read-only boundary, a cold start, one full auth cycle. Bridge §5's check 5 by hand, as the demo account |
| 6 | Presentation | README screenshots taken from the live site; ADR index complete; both repositories link to each other; the live URL opened in a clean browser profile |

**Exit:** `v1.0.0`.

---

## 9. Testing strategy

| Layer | Type | Tooling | What it covers |
|---|---|---|---|
| Tokens and helpers | Unit | Vitest | Contrast ratios, claim decoding, `curl` formatting, pagination parsing, query-string round trips |
| `ui/` primitives | Component | Vitest + RTL | Every state and variant, keyboard interaction, ARIA |
| Features | Component | Vitest + RTL + MSW | Behaviour against mocked HTTP, including every error status |
| Flows | End-to-end | Playwright + MSW, against the `e2e` build (ADR 0012) | Login, refresh, search, mutate, conflict, inspect |
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
| The access token is never written to storage | Lint rule banning `localStorage` and `sessionStorage` outside tests and one mock file, `src/lib/testing/persistence.ts` (section 14, PR 10) |
| The generated schema matches the deployed document | CI regenerates and diffs |
| No manual memoisation if the compiler is on | Lint rule, decided in PR 1 |
| Status colour is never applied to an entity status | Lint rule restricting the status tokens to the inspector and response modules |
| The mock never reaches a production bundle | `no-restricted-imports` on `@/lib/testing` outside tests, and the `build-and-test` job searching `dist/assets` after the production build (ADR 0012) |
| Code and configuration stay formatted | `pnpm format:check` in `build-and-test`; the hand-wrapped documents under `docs/` are excluded in `.prettierignore` (decision 18) |
| The console sends its own security headers, and its policy connects only to the deployed API | `src/lib/api/security-headers.test.ts` reads `public/_headers`: `connect-src` is `DEPLOYED_API_ORIGIN`, scripts and styles come from `'self'` only, nothing may frame the console. What Pages serves is checked by hand after a deploy (ADR 0015) |

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
| 1 | **A public landing page in front of the console.** One page, editorial density, explaining the project and linking into the demo. | The console is behind a login, so a reviewer arriving from a CV link currently meets a sign-in form and nothing else. A landing page is roughly one additional PR and is where the project is actually read. Decide before M4, since the app shell is shaped by whether `/` is a landing page or a redirect to `/users`. Decided on 2026-09-27, below. |
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

Raised at the end of M3 and decided on 2026-09-27, each as proposed. Items 17
and 18 were first listed in README-FIRST section 5.

| # | Question | Decided | Bearing |
|---|---|---|---|
| 1 | **A public landing page.** | None in v1. `/` redirects to `/users`, and the sign-in screen - already the one editorial screen - carries two sentences on the project and links to both repositories. The README of PR 17, with its diagram and screenshots, is where the project is read. A public route would have had to bypass the boot refresh that Gate 3 proved runs before every route. Overturning it after `v1.0.0` is a route and one exception in boot. | Section 7 PR 16, inventory §3.2 |
| 17 | **The `roles` screen was assigned to no pull request.** | PR 16, where navigation first has more than one destination. The read already exists for the assign-role dialog. | Inventory §3.7, §6 |
| 18 | **When the format fix for PR 1-3 runs, and what it covers.** `pnpm format:check` fails on 33 files at `13d53cf`, not 37: 23 lack only a final newline, 4 also reflow (`Button.tsx`, `Dialog.tsx`, `Table.tsx`, ADR 0004), and 6 documents differ otherwise, ADR 0013 among them. | Its own pull request after PR 16, GitHub #18, behind the directory fix (#17); the plan's PR 17 becomes GitHub #19. `docs/**/*.md` enters `.prettierignore` - hand-wrapped documents whose tables Prettier would realign on every edit - the other 23 files are formatted, and `pnpm format:check` joins `build-and-test` so the list cannot grow again. | Section 7, section 14, protocol section 5 |

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
| §4.4 | CI regenerates the types and fails on a difference | A separate `contract` job, not required: the document lives on a free instance, and a merge does not wait on its uptime. ADR 0006. PR 7. |
| §8 Gate 0 | Probe 10a before PR 6 | Run as the first step of PR 7, because PR 7 could not be written without knowing the document was served. Rows 59-64. PR 7. |
| §11 M1 | PR 8 mocks "the whole surface" | Everything the console calls, plus health. Not mocked: the HATEOAS media type, v2 and v3 (rows 31-33), `HEAD` and `OPTIONS` (row 63) - the console uses none of them. PR 8. |
| §3.2 | The mock sets and reads the `umapi_rt` cookie like a browser | MSW's jar ignores `credentials`; the mock reads the value only, and whether a browser sends it is proven in M5. PR 8. |
| §2 | MSW's postinstall | Not run: `allowBuilds: { msw: false }` in `pnpm-workspace.yaml`. The worker is committed as `public/mockServiceWorker.js` and regenerated with `pnpm mock:worker` after an MSW upgrade. It is copied into `dist/` and stays inert there: nothing in a production bundle registers it. PR 8. |
| §6.1 | Two outcomes of the refresh race, equally likely | Three rounds out of three were the 409 live (observed row 11). The 401 stays designed and mocked. PR 6. |
| §9 Testing, §14 PR 2 | Playwright drives the production bundle | It drives the `e2e` build: the production build plus the mock, started by the same build-time literal as on the dev server. From PR 9 every route asks the API for a session first, and a required check cannot depend on a sleeping free instance. The production build is searched for the mock and the specimen on every CI run instead of by the apply script. ADR 0012. PR 9. |
| §8 Gate 3 | "A test asserting storage is empty after login" | MSW keeps the cookies of mocked responses in `localStorage` (`__msw-cookie-store__`), so storage is never empty under the mock. The test asserts that no storage entry contains the access token, which is the invariant itself. PR 9. |
| §4.4 | Every call through the generated client | The three auth calls are typed from section 3.2 in `src/lib/api/auth-contract.ts`, with a second client configured like `api`. The generated schema still describes today's bodies (rows 1, 6); M5 regenerates it and deletes the file. ADR 0007. PR 9. |
| Inventory §6 | `cold-start` in PR 16 | The notice and the rate-limit countdown are shared `ui/` components from PR 9, because `boot` and `sign-in` list both as states. "Shown once per session" stays with PR 16. PR 9. |
| Inventory §3.1, §3.2 | Four boot states; no sign-in state for a locked account or an unanswered request | Boot adds `rate-limited` and `unavailable`, sign-in adds `account-locked` and `failed`, each with copy. The code has to do something in each case, and the inventory is where that is decided. PR 9. |
| §10 Invariant | Storage ban and feature boundaries as lint rules | Both arrive with the first feature: `no-restricted-globals` and `no-restricted-properties` on `localStorage` and `sessionStorage` outside tests; `no-restricted-imports` per feature, for `lib/` and for `@/lib/testing` outside tests. ADR 0003 asked for a boundary entry per feature; `FEATURES` in `eslint.config.js` is that list. PR 9. |
| §7 PR 9 | "Login route" | `/sign-in`, the inventory's name. The branch keeps `feat/login`. PR 9. |
| §8 Gate 1 | `/_design` reviewed at 380px, the item left open at the end of M0 | Reviewed in PR 9. One defect: a `Card` let an email address escape its border, because an address has no break opportunity and a flex item does not shrink below its content. `Card` now sets `min-w-0` and `overflow-wrap: anywhere`, so no panel - the detail panels of PR 13 included - can be pushed open by an identifier. Layout is not observable in jsdom, so the fix has no unit test; it was verified in the browser at 380px. Gate 1 is closed. PR 9. |
| §8 Gate 3 | The reload proven on `/users/<id>` | Proven on `/?view=reload`, the deepest route that exists: `/users/:id` arrives in PR 13, which moves the spec to it. The query shows the whole address survives the reload, not only the path. PR 10. |
| §8 Gate 3, ADR 0012 | Both outcomes of the refresh race proven by Playwright from PR 10, which would expose the mock's scenario controls to a spec | Both move to PR 11, which builds the session screen that presents them. No spec in PR 10 needs a scenario control, so none is exposed yet. PR 10. |
| §10 Invariant | Browser storage banned outside tests | One more exception: `src/lib/testing/persistence.ts` keeps the mock's refresh tokens in `sessionStorage` across a reload. In the browser the mock's database lived in the page while MSW's cookie jar survived in `localStorage`, so a reload in `pnpm dev` or the `e2e` build landed on sign-in: the mock behaved unlike the API. Mock code, in no production bundle; the access token is not in it. PR 10. |
| §4.2, §4.3 | The refresh belongs to the auth feature | `src/lib/api/refresh.ts`: the client's middleware needs it, and `lib/` imports nothing above it (ADR 0003). The session provider hears every outcome through `onRefresh`. Client creation moved to `src/lib/api/create-client.ts`, so the application client and the auth client are built without an import cycle. ADR 0008. PR 10. |
| Inventory §2.3, §2.4 | The session ends on `Auth.InvalidRefreshToken`, no `errorCode` or reuse; a refresh that fails is `session-ended` | Every 401 on refresh ends it, `Auth.AccountLocked` (row 51) included, with the generic wording. Any other answer - 429, 5xx, none - reaches the screen that made the request as its own answer, and the session stays. PR 10. |
| §7 PR 10 | Logout | `Sign out` on the placeholder at `/` until the shell arrives in PR 16. Sign-in follows with no banner and no `next`. The session is forgotten whatever the API answers; a refused or unanswered logout leaves the cookie valid, so a reload would restore the session. Not surfaced in v1. PR 10. |
| §4.2 Folder layout | Permission gates in `features/auth/` | Claim decoding, `useCan` and the gate's reason in `src/lib/api/` (`claims.ts`, `permissions.ts`), because every feature asks and a feature may not import another (ADR 0003). The access token store became observable for it. The route guard, `RequirePermission`, stays in the auth feature. ADR 0009. PR 11. |
| §8 Gate 3 | Playwright proves the access token is gone from memory at once after reuse | A browser test cannot see memory. Playwright proves both screens; the token cleared at once, and the winner's 200 unable to restore it whichever answer arrives first, are unit tests on the demonstration's adoption step. PR 11. |
| §8 Gate 3 | A gated action proven on a real action | No screen carries a mutation before PR 13, and the demonstration is deliberately not gated (decision 5). Proven on the lock action, the one PR 13 renders, through the same `useCan`; PR 13 asserts the same on the screen. PR 11. |
| §6.1, decision 13 | Both responses of the race in the inspector | Listed on the session screen, one line each, until the inspector arrives in PR 15. `revoked` shows neither, because the session ends at once and sign-in follows. PR 11. |
| §8 Gate 3, ADR 0012 | The mock's scenario controls exposed to a spec in the `e2e` build | `startMockWorker` places them on `window.__umapiMock` when `main.tsx` passes the `e2e` literal; the dev server does not. The CI search of the production `dist/assets` includes the name. The scenario resets on reload, so a spec sets it after the page has loaded. PR 11. |
| §2 | TanStack Query at the version current on the day | 5.104.0 was published the same day. `pnpm add` of a version younger than pnpm's release-age policy installs it and writes an exclusion into `pnpm-workspace.yaml` without asking. 5.103.2, five days old, needs none. PR 12. |
| §4.2, ADR 0010 | Query client wiring unspecified | `src/app/query-client.tsx`: `retry: false`, `refetchOnWindowFocus: false`, and the cache dropped whenever the access token is cleared, so a second account on the same tab never sees the first one's data. PR 12. |
| §7 PR 12 | The directory on existing primitives | Three more in `ui/`, each on `/_design`: `Select` for the status filter, `EntityStatus` for DESIGN-DECISIONS section 10, `SkeletonRow` for `loading-first`. PR 12. |
| Inventory §3.3 | Sortable by the whole whitelist of row 47 | By `email`, `firstName`, `lastName` and `status`, one column each. The list response carries no `createdAt`, so no column could show that order. PR 12. |
| Inventory §3.3 | No state for a 429 on the read | `rate-limited`: the status and title in place of the table, Retry held by the shared countdown until `Retry-After` has passed. Reads are a hundred a minute per user (row 52), within reach of fast typing. PR 12. |
| Inventory §3.3, §4 | Row states and keyboard traversal with the directory | Rows have hover only. Focus, selection, arrow keys and activation arrive with the detail route in PR 13, because a row that cannot be activated has nothing to focus for. PR 12. |
| Inventory §2.8 | *Open the inspector to see the full response.* in the error state | Left out until the inspector exists in PR 15. PR 12. |
| §6 Test conventions | No per-test handlers | The directory's 5xx and unanswered request are one-off `server.use(..., { once: true })` handlers in its test, because the mock has no measured 5xx on the endpoint and inventing one in the mock would be a branch with nothing to cite. PR 12. |
| §7 PR 12 | The directory reached from the shell | A *Users* link on the placeholder at `/`, beside *Session*, until the shell arrives in PR 16. Whether `/` becomes a landing page or a redirect to `/users` stays open decision 1. PR 12. |
| §7 PR 13, inventory §6 | The 409 conflict path in PR 14 | In PR 13. An optimistic update without its rollback and the panel that explains it is half a mutation, and section 6.3 and inventory §3.4 already described them together. PR 14 is caching alone. PR 13. |
| §6.3, inventory §6 | Role assignment only | Removal as well: row 48 names it, the API and the mock have it, and inventory §3.6 and the unmeasured `User.LastRoleCannotBeRemoved` already assumed its dialog. A destructive confirmation like the lock's. PR 13. |
| Inventory §3.4 | `User.EmailNotUnique` as a `conflict` with Reload | On the email field, like a 422: the record did not change, and "reload" would have been untrue. PR 13. |
| Inventory §3.4 | No state for a refused edit's fields | `editing` and `invalid`: the edit is inline in the identity panel, the API's 422 lands on its field. `forbidden`, `rate-limited` and the write's `error` gained their copy. PR 13. |
| Inventory §3.3 | "Selected" named but not defined | The row whose detail was just open, kept in the directory's own history entry: Back and *Back to users* return to it, lifted and focused. A changed filter forgets it. No storage. PR 13. |
| Inventory §3.5, §3.6 | Dialogs without an action row; lock copy "signs out their sessions" on `/_design` | `Dialog` takes the action it confirms beside Cancel and holds while it is in flight; `/_design` carries the copy of row 51. Unlock and remove-role gained their own copy. PR 13. |
| §8 Gate 3 | The reload proven on `/users/<id>` | Done: the spec opens the demo user's row from the directory and reloads the detail. PR 13. |
| §8 Gate 3 | A gated action on the real screen | Done: the demo account meets Edit, Lock, Assign role and Remove disabled with their reasons, and no write is sent. PR 13. |
| §4.2 | Error types unspecified | `RequestError`, shared by the users feature's reads and writes (it was `DirectoryError` in PR 12), and the read's `Failure` state shared by the directory and the detail. PR 13. |
| README-FIRST §6 | ADR 0010 "collection state in the URL", 0011 "no state-management library" | ADR 0011 carries both, written in PR 13; 0010 stays the server-state decision of PR 12. |
| §6.2, §2 | The browser's HTTP cache left to its defaults | Bypassed with `cache: 'no-store'` on every request of the API client. The API's `private, no-cache` lets the browser revalidate a first read on its own, and `fetch` then reports a 200 from the browser's cache for what was a 304 on the wire - the one status inventory §2.9 says to show. ADR 0013. PR 14. |
| §6.2 | "The `ETag` is kept", where unstated | In the TanStack Query cache entry, beside the data it validates: a re-read of a key sends that entry's tag, and a 304 returns the same data with status 304, so nothing re-renders and no separate map of tags can disagree with the bodies. The directory, the detail and the roles alike. ADR 0013. PR 14. |
| Inventory §3.4 | A 304 visible in the directory's footer only | Also in the detail's concurrency panel: *The last read answered 304 Not Modified: the record has not changed since this tag.* It is what the tag is for. PR 14. |
| §8 Gate 3 | Two rows still saying the reload spec and the real actions "arrive in PR 13" | Corrected after the fact; PR 13 moved the spec and added the actions but not these two rows. PR 14. |
| Observed, still to measure | 304 measured without an `Origin` | Rows 23 and 24 were measured from PowerShell. Whether a 304 to a browser origin carries the CORS headers is unmeasured, and proven in M5 by the live specs. PR 14. |
| §4.2, §4.4 | The inspector store in `features/inspector/`, fed by a response interceptor | The record is `src/lib/api/capture.ts`, written by the transport both clients send through (`transport` in `create-client.ts`); the feature only renders it. The client writes it and `lib/` imports nothing above it, and a middleware would not have seen the silent refresh's replay, which is now sent through the transport too. ADR 0014. PR 15. |
| Inventory §3.8 | Only `copy as curl` keeps the token out | Nothing in the record is a credential: the `Authorization` header, and `password`, `accessToken` and `refreshToken` in any JSON body, sent or received, become placeholders as they are recorded. Sign-in bodies carry a password and sign-in and refresh answers an access token; the inventory had covered only the header. PR 15. |
| Inventory §3.8, ADR 0010 | The record's lifetime unstated | One session: dropped when the token goes from held to none, like the query cache. So `revoked` cannot show the race's pair, and inventory §3.9 says so. PR 15. |
| Inventory §3.8 | "Dockable"; `expanded` and `selected` as two states | Docked at the bottom, collapsed or expanded; no choice of edge. One row is always selected - the newest until another is chosen - so opening the inspector after an error lands on its response. The list is newest first. `unanswered` added: `StatusDot` gained it, because a request nothing answered would otherwise read `pending` for ever. PR 15. |
| Inventory §2.8, §3.2 | The pointer to the inspector joins sign-in's `failed` in PR 15 | Not on sign-in or boot: the inspector is behind the login. It is in `Failure`, shared by every read, and only when the API answered. PR 15. |
| Inventory §3.9 | The pair listed on the session screen until PR 15 | Removed from the screen; `raced` and `unexpected` keep their sentences, and the pair is in the inspector. `e2e/race.spec.ts` finds it there. PR 15. |
| §8 Gate 5 | Captures equal requests; `$TOKEN` in curl | Both proven in PR 15, each test failing when its rule is removed: the replay sent past the transport, the redaction switched off. The session's clearing and the body redaction likewise. PR 15. |
| Inventory §3.10, §3.11, §5 | `/` a landing page or a redirect; `roles` assigned to no PR | `/` redirects to `/users` inside `RequireSession`, so an anonymous visitor at `/` still reaches sign-in with no `next`. `roles` is `/roles` behind `roles.read`, in `features/users` beside the query it shares with the assign-role dialog. The placeholder `App.tsx` is gone. Decisions 1 and 17. PR 16. |
| Inventory §2.6, §3 shell | A gated destination unstated for navigation | Every navigation entry is always shown; a route the token does not permit states its reason in place (`RequirePermission`). The demo account and the administrator hold every read. PR 16. |
| Inventory §2.1, §2.2 | Cold-start per screen; offline from `navigator.onLine` or a request with no response | Both read the transport's record (ADR 0014). Cold-start is the shell's, once per session, beneath the header; boot and sign-in keep their own. Offline also ends with the next answered request, not only the `online` event, or one CORS failure would leave the bar up for the visit. `src/lib/api/connection.ts`. PR 16. |
| Inventory §4 | Route change moves focus to the `h1` | The shell does it, unless the screen has placed focus inside its `main` - the directory's opened row, the detail's heading - because a parent's effect runs after its children's and would otherwise take it back. `Escape` clears the search by a handler, since not every browser does it for a search field. PR 16. |
| Inventory §3.10 | `404` inside the product | Outside the shell, in editorial density, with a session or without. PR 16. |
| §2 Testing | `axe-core` in Playwright | `@axe-core/playwright` 4.13.0, pinned exactly, its first release older than the workspace's minimum release age; `pnpm-workspace.yaml` unchanged. PR 16. |
| §7, §12 decision 18 | The format fix as GitHub #17, the plan's PR 17 as #18 | Two pull requests outside the plan's count come before its PR 17: the directory fix is GitHub #17, the format fix #18, and the plan's PR 17 is GitHub #19. The plan keeps its own numbers. GitHub #17. |
| §5.3, inventory §3.3 | Each change to the view written from the view on screen | Built from the address as last written, kept beside the screen and brought up to date by every navigation, not from the render's query. A status chosen right after a sort, before the sort's navigation had rendered, dropped the sort; the same held for paging, the empty states' actions and the debounced search. Present since PR 12, seen as a test that passed only on retry in PR 16's CI run. React Router's updater form of `setSearchParams` is handed the render's parameters too, so it does not fix it. A unit test makes two changes with no render between them. GitHub #17. |
| §12 decision 18 | The format fix as decided | As decided: `docs/**/*.md` in `.prettierignore`, which also covers the ten documents on the list, the 23 code and configuration files formatted - 20 gained only their final newline, `Button.tsx`, `Dialog.tsx` and `Table.tsx` also reflowed - and `pnpm format:check` in `build-and-test` after lint. Section 10 gained the row. GitHub #18. |
| §2, CI | The runner image unstated | Every job on `ubuntu-24.04` instead of `ubuntu-latest`, which GitHub moves to Ubuntu 26 from 2026-10-19. A change of image becomes a pull request rather than a run that turns red on its own. GitHub #18. |
| §3.2, bridge §2 | The cookie cleared by logout and when reuse is detected | Cleared by logout and by every refusal of a refresh that carried a cookie; never by a 409. The API's #50 (ADR 0019, observed row 70), recorded in bridge §3; the two tables edited together, and the mock follows. Step 3, `fix/mock-api-parity`. |
| §7 M5 | One console pull request in M5, the plan's PR 17 as GitHub #19 | Step 3 puts console pull requests ahead of PR 17: the mock brought to the API, the regenerated contract, the record of the checks. PR 17 takes the next GitHub number after them. Step 3, `fix/mock-api-parity`. |
| §7 PR 8, the factories | Addresses transliterate đ as `dj` | `d`, as the API's seed folds addresses (row 73), so `djordjevic` finds no one in either. Step 3, `fix/mock-api-parity`. |
| §7 PR 8, the mock in `pnpm dev` | A second tab signs in afresh | Since row 70 the second tab's refused refresh clears the cookie both tabs share, so the first tab's session ends at its next refresh. The mock's tokens are kept per tab (`persistence.ts`); the API's are not, so the API keeps both. Step 3, `fix/mock-api-parity`. |
| §7 PR 8, the mock's headers | Response headers as measured (row 38) | The mock sends no `X-Correlation-Id`, which the API exposes since #50 (row 53's note): the inspector shows it against the API and not against the mock. Deferred by name. Step 3, `fix/mock-api-parity`. |
| Inventory §3.1 | No state for a deactivated account | `Auth.AccountDeactivated` (row 71) reads as `invalid-credentials`. Unreachable on the demo directory, whose seeded users cannot sign in; the mock refuses its own deactivated users that way. Step 3, `fix/mock-api-parity`. |
| §4.4, ADR 0007 | M5 deletes `auth-contract.ts` and the three auth calls move to `api` | The file is deleted and the calls are typed from the regenerated document (row 75), but they stay on a client of their own, `authApi` in `auth-client.ts`: `api` carries the silent refresh, and an auth call through it would carry the access token and refresh itself, which ADR 0008 rules out. ADR 0007 is left as written. Step 3, `feat/api-contract-m5`. |
| Inventory §3.8, §2.2 | A request that settles without a response is `unanswered` | A request the console cancelled - its `AbortSignal` aborted - is `cancelled`: named in the inspector and never a reason for `offline`. Found by M5 step 3's check 8 against the local API: in development React mounts a screen twice, the first read is cancelled, and the inspector read *no response* while `offline` could flash until the second read settled. No test met it: the unit tests do not mount a screen twice, and the e2e suite runs a production build (ADR 0012). `fix/cancelled-is-not-unanswered`. |
| §6 Test conventions, PR 16's `Shell.test.tsx` | The cold-start test waits in real time, and the shell under test waits a second for the boot | The cold-start test runs on fake timers once the shell is up: the threshold, the notice's own tick and the mock's cold start are all timers, so the outcome no longer depends on the machine. `renderShell` waits up to three seconds for the boot refresh, which goes through the mock in real time. Seen failing three times when the apply script piped test output through PowerShell 5.1 (GitHub #19's notes), never in a direct run. `fix/shell-test-timing`. |
| Gate 6 row 3, bridge §5 | Eight checks by hand against the local API | Seven ran, on 2026-10-04 and 05 (rows 76-82). Check 5, the demo account's disabled writes, moved to step 5: Neon `dev` has no demo account, by the API's own decision (`DatabaseSeeder`, row 80), and seeding one there was not done. `docs/local-api-checks`. |
| Bridge §5 check 6 | The race shows 409 or 401 reuse, and a second browser meets the generic wording | Seven rounds, seven 409s (row 78), as in production (row 11); the 401 path did not occur, so the second browser's wording was not seen by hand. It stays covered by `e2e/race.spec.ts` against the mock and by row 66's reuse on Kestrel. `docs/local-api-checks`. |
| Inventory §3.9 | `unexpected` for any other pair | Repeated rounds meet the auth limit, and a pair of 429s reads `unexpected` without §2.7's countdown (row 79). Left as it is; an open item for step 6. `docs/local-api-checks`. |
| §7 M5 step 4, bridge §6 | The production build sets `VITE_API_BASE_URL` to `https://api.<domain>` | Not set. The deployed origin moved in its three places - `DEPLOYED_API_ORIGIN` in `src/lib/api/create-client.ts`, `api:generate` in `package.json`, `API_ORIGIN` in the `contract` job - to `https://api.aleksadragnic.com`, and every build takes it from the repository, so the types and the default target come from one origin (ADR 0006). A variable in Cloudflare Pages would be a fourth place, outside the repository. `src/lib/api/schema.d.ts` was regenerated from the new address and is identical, byte for byte, so it is not in the diff. `chore/api-custom-domain`. |
| §7 M5 step 4 | `ASPNETCORE_HTTPS_PORT` updated in the Render dashboard | Unchanged: it was already `443` (the API's `render.yaml`), and the custom domain is served on 443 too. Only `Cors__AllowedOrigins__0` = `https://console.aleksadragnic.com` and `Cors__AllowCredentials` = `true` were added. `chore/api-custom-domain`. |
| §2 Hosting | Cloudflare Pages building with the repository's pins | Pages reads Node from `.nvmrc` and pnpm from `packageManager`, and activates pnpm 12.4.2 itself before the build command (observed row 89). The project skips Pages' own install (`SKIP_DEPENDENCY_INSTALL=1`), so the install is `--frozen-lockfile` as in CI: the build command is `pnpm install --frozen-lockfile && pnpm build`, output `dist`. No `VITE_*` variable is set, so the production bundle has no mock and the committed origin. Deep routes need no redirect file: with no top-level `404.html`, Pages serves `index.html` for every path (row 87). `chore/api-custom-domain` recorded this row wrongly - pnpm only from `PNPM_VERSION`, and a global npm install in the command - and the first build failed on it; corrected in `docs/domain-and-hosting`. |
| §2 Hosting | A preview deploy per pull request | Previews still deploy, but a preview on `*.pages.dev` is cross-site to `api.aleksadragnic.com` and outside its CORS list, so it shows the console's boot failing and never the API's data (section 3.3). Only `console.aleksadragnic.com` talks to the API. `chore/api-custom-domain`. |
| Gate 6 row 4 | `console.<domain>` and `api.<domain>` resolve and serve TLS; the cookie observed on a request from the console origin | Done on 2026-10-05 on `console.aleksadragnic.com` and `api.aleksadragnic.com` (observed rows 83-87). The demo account's disabled writes were seen on the detail screen in production (row 86); that activating one sends nothing stays with Gate 6 row 5, by hand. `docs/domain-and-hosting`. |
| §2 Hosting | Cloudflare Pages | Still Pages, though the dashboard now calls it the legacy workflow and offers a Worker first (observed row 90). `docs/domain-and-hosting`. |
| §2 Hosting | Nothing between the bundle and the browser | Cloudflare's edge injected a Web Analytics beacon into the HTML until it was switched off in the dashboard (observed row 88). `dist` never contained it, so no check in this repository can see it return; a `Content-Security-Policy` that allows scripts only from `'self'` would refuse it. `docs/domain-and-hosting`. |
| §10 Invariant | Nothing about the console's own response headers | Opened by `docs/domain-and-hosting`: Pages sent no `Content-Security-Policy` for the console (observed row 87), while the API sends one on every response (row 38). Closed by `public/_headers`: a policy from `default-src 'none'` allowing scripts and styles from `'self'`, fonts from `'self'` and `data:` (the one subset Vite inlines), the API alone for `connect-src`, no workers, no `<base>`, no form posts and no framing, with `Strict-Transport-Security: max-age=2592000`, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy: no-referrer` - the API's own set. ADR 0015; asserted in section 10. Measured on Pages after the deploy, in step 5's record. `feat/security-headers`. |
| ADR 0006 | The deployed origin written in three places | Four: `public/_headers` names it in `connect-src`. ADR 0006 is left as written; `src/lib/api/security-headers.test.ts` holds the fourth to `DEPLOYED_API_ORIGIN`, so a move of the origin that misses it fails the unit suite. `feat/security-headers`. |
