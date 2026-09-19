# umapi-console — Screen and state inventory

Twelve screens, and every state each of them can be in. This document is written
before the code and is what the pull requests are built from. It lives in the
repository at `docs/SCREEN-INVENTORY.md`.

A screen that has no empty state has not been designed, it has been drawn. The
purpose of this file is to make the states that are usually improvised at
implementation time into things that were decided on purpose, with copy already
written.

---

## 1. How to read this

Each screen has a table of states. A state has a **trigger** (what puts the
screen into it), **what renders**, and **the way out** (what the user can do
next). Copy is written in the table and is the copy that ships; it is not
placeholder.

States that recur across screens are defined once in section 2 and referenced by
name. They are rendered by shared components in `ui/` and `app/`, never
re-implemented per feature.

Every screen is assumed to have a **ready** state; it is listed only when it
carries something worth stating.

---

## 2. Cross-cutting states

These are the ones that make an application feel finished, and the ones that get
skipped.

### 2.1 `cold-start`

The API runs on a free instance that suspends when idle. The first request after
a suspend takes up to roughly 30 seconds and can fail outright. Measured against
the deployed instance, a readiness probe against a stopped database took 56
seconds before answering, because the retry strategy makes five attempts.

| | |
|---|---|
| Trigger | Any request still pending after 1200 ms |
| Renders | The screen's own loading state, plus a line beneath it: *Waking the API. The demo runs on a free instance that sleeps when idle — this can take up to 30 seconds.* Ash gray, mono, 12px. A pending status dot, never a spinner that implies imminence. |
| The way out | Resolves into the screen's ready or error state |
| Note | The message appears once per session. A second slow request does not repeat it. |

### 2.2 `offline`

| | |
|---|---|
| Trigger | `navigator.onLine` is false, or a request fails with no response at all |
| Renders | A persistent bar under the app shell header: *No connection. The console cannot reach the API.* Mutations are disabled while it shows. |
| The way out | The `online` event; the bar disappears and the active query refetches |

### 2.3 `refreshing` — a 401 met by a silent refresh

Not a visible state on most screens, and that is the requirement. A 401 on a
background query triggers one refresh and the queued request replays; the user
sees nothing but a slightly longer load.

It becomes visible only when the refresh itself fails, which is `session-ended`.

### 2.4 `session-ended`

| | |
|---|---|
| Trigger | Refresh returns 401, or the API reports reuse detection |
| Renders | Everything is cleared from memory and the router navigates to `/sign-in`, with a banner on that screen: *Your session ended. Sign in again.* After reuse detection the wording is specific: *This session was ended because a refresh token was replayed. Every token in the chain has been revoked.* |
| The way out | Sign in |
| Note | The intended destination is kept in the URL as `?next=` and honoured after sign-in. |

### 2.5 `forbidden` — 403

Never a page. A 403 from the API is a bug in the UI, because the UI knows the
token's permissions and should not have offered the action. It is therefore
rendered as a dismissible error in place, and the action that produced it is
disabled afterwards.

The *expected* form of this — the demo account meeting a write action — is
`gated`, below, and never reaches the network.

### 2.6 `gated` — an action the token does not permit

| | |
|---|---|
| Trigger | The action's required permission is absent from the access token's claims |
| Renders | The control is rendered, disabled, with `aria-disabled` and a reason beneath or in its tooltip: *Requires `users.write`. This account holds `users.read`, `roles.read`.* |
| The way out | Sign in as an account that holds the permission |
| Note | Disabled, never hidden. A hidden control teaches a reviewer nothing; a disabled one with a reason demonstrates the whole permission model in a glance. |

### 2.7 `rate-limited` — 429

| | |
|---|---|
| Trigger | 429 from the API, most reachably on repeated sign-in attempts |
| Renders | In place, with the wait read from `Retry-After`: *Too many attempts. Try again in 42 seconds.* The count ticks down and the submit control re-enables at zero. |
| The way out | Wait, or change nothing and retry after the countdown |

### 2.8 `server-error` — 5xx

| | |
|---|---|
| Trigger | 5xx, or a response that is not JSON when JSON was expected |
| Renders | The screen's error state with the status and the `title` from the problem details body, plus *Open the inspector to see the full response.* |
| The way out | Retry, which refetches rather than reloading the page |

### 2.9 `not-modified` — 304

Not an error and not hidden. The data on screen is unchanged; the inspector
records a 304 with its duration, and the directory footer shows the status of
the request that produced the current view. This is the only place in a normal
application where a 304 is visible to the user, and showing it is the point.

---

## 3. The screens

### 3.1 `boot` — before the application knows who you are

The first screen anyone meets, and the one most applications skip, producing a
flash of the sign-in form for a user who is signed in.

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `checking` | Application mount, always | The app mark, centred on black, and nothing else. No spinner before 400 ms. | Refresh resolves |
| `checking-slow` | Still checking after 1200 ms | Adds `cold-start` copy | Resolves |
| `authenticated` | Refresh returned an access token | Router proceeds to the requested route | — |
| `anonymous` | Refresh returned 401 | Router navigates to `/sign-in?next=<path>` | Sign in |

The requirement is that an authenticated user reloading `/users/7c41ab` never
sees the sign-in screen.

### 3.2 `sign-in`

Editorial density. The only screen in the application that uses display type.

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `ready` | — | Email, password, submit. Demo credentials printed below the form in mono. | Submit |
| `submitting` | Submit | Button shows a pending state, fields are `readonly` not disabled, so focus is not lost | Response |
| `invalid-field` | 422 | Field-level messages taken from the problem details `errors` object, rendered under the field they name, in alarm red mono 12px. Focus moves to the first invalid field. | Correct and resubmit |
| `invalid-credentials` | 401 | One message above the form: *Email or password is incorrect.* Never *"user not found"* — that is an account enumeration oracle. | Retry |
| `rate-limited` | 429 | §2.7 | Wait |
| `session-ended` | Arrived from §2.4 | The banner, above the form | Sign in |
| `cold-start` | §2.1 | Beneath the submit button | Resolves |

### 3.3 `users` — the directory

Application density. The screen the project is judged on.

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `loading-first` | First load of the route | Skeleton rows at the real row height, header and toolbar already live | Data |
| `loading-refetch` | Query change, page change | Existing rows stay, dimmed to 60%, toolbar stays interactive. **The table does not collapse to a spinner.** | Data |
| `ready` | Data | Rows, pagination from `X-Pagination`, status line in the footer | Interaction |
| `not-modified` | §2.9 | Unchanged rows, footer shows `304` | — |
| `empty-search` | 0 results with a search term | *No users match "ovic".* Below it, a ghost **Clear search** control. Footer still shows `200 · 0 results`. | Clear, or edit the term |
| `empty-filter` | 0 results with a status filter and no term | *No users with status Locked.* With a **Clear filter** control. | Clear |
| `empty-page` | A page number beyond the last page, usually from an old link | *Page 9 is past the end. There are 7 pages.* With a control to go to page 1. | Go to page 1 |
| `error` | §2.8 | The table area replaced by the status, the title, and **Retry** | Retry |
| `offline` | §2.2 | Bar at the top, rows stay visible and readable | Reconnect |

**Toolbar states.** The search input is debounced at 300 ms; the debounce is
visible as a pending dot in the footer rather than hidden. Sorting is restricted
to the API's whitelisted fields, and an unsortable column header is not
clickable rather than clickable-and-ignored.

**Row states.** Default, hover (surface lift), focused (visible ring, reached by
keyboard), and selected. Entity status — Active, Pending, Locked — renders as
neutral text with an icon for Locked. See the design decisions, section 10.

### 3.4 `users/:id` — user detail

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `loading` | Route entry | Skeleton in the three panels, header shows the email from the list if it was navigated from there | Data |
| `ready` | Data | Identity, roles and concurrency panels. `ETag` shown in the concurrency panel, because the whole 409 story depends on it being visible. | Actions |
| `not-found` | 404 | *No user with that id.* With a link back to the directory. Distinct from the application's own 404 route. | Back |
| `saving` | A mutation in flight | The changed field updates optimistically; the panel carries a pending dot | Response |
| `conflict` | 409 | The optimistic update rolls back, and a panel appears: *This record changed since it was read. Reload to see the current version, then apply the change again.* With **Reload**. Never a toast — a toast is dismissed before it is read, and this is the most interesting failure the API produces. | Reload |
| `gated` | §2.6 | Write controls disabled with their reason | Sign in as administrator |
| `forbidden` | §2.5 | In-place error, the control disables | — |
| `error` | §2.8 | Panel-level error with **Retry** | Retry |

### 3.5 `assign-role` — dialog

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `open` | The action | Focus trapped, focus on the first control, `Escape` closes, the trigger regains focus on close | Assign or cancel |
| `loading-roles` | Open | The list area shows a skeleton; the dialog does not resize when it fills | Data |
| `no-roles-available` | Every role already assigned | *This user already holds every role.* The assign control is disabled. | Cancel |
| `submitting` | Assign | Control pending, dialog stays open | Response |
| `invalid` | 422 | Message inside the dialog, focus to the offending control | Correct |
| `conflict` | 409 | The dialog closes and the detail screen enters `conflict` — the conflict belongs to the record, not to the dialog | Reload |

### 3.6 `lock-user` / `unlock-user` — confirmation dialog

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `open` | The destructive action | The consequence in plain words: *Locking Marko Petrović signs out their sessions and refuses new sign-ins until unlocked.* Confirm is a ghost control with an alarm-red border. Focus starts on **Cancel**, not on the destructive control. | Confirm or cancel |
| `last-administrator` | The API refuses because a user must retain a role, or the last administrator cannot be locked | The domain rule stated as the API returned it, not paraphrased | Cancel |
| `submitting` / `error` | As above | | |

### 3.7 `roles` — read-only list

Read-only by design: roles are seeded and managing them over HTTP is out of
scope for v1 of the API. That is stated on the screen rather than left as an
absence.

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `ready` | Data | Role name, its permissions as mono badges, and a line: *Roles are seeded by the API and are read-only in v1.* | — |
| `loading` / `error` | | Skeleton, §2.8 | Retry |

### 3.8 `inspector` — the docked panel

Not a route. Available from every screen behind the login, and the reason the
project exists.

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `collapsed` | Default | A strip showing the most recent request: status dot, code, method, path, duration | Expand |
| `empty` | Expanded with no requests captured yet | *No requests yet. Everything this console sends to the API appears here.* | Do something |
| `expanded` | Expand | Request list on the left, request and response panes on the right | Select, copy, clear |
| `selected` | A row is selected | The two panes fill; the selected row carries a left border in its status colour | Select another |
| `pending` | A request in flight | The row appears immediately with a pending dot and no duration, then updates in place. Requests are not held back until they resolve. | Resolves |
| `truncated` | A response body over 64 kB | The first 64 kB with *Response truncated at 64 kB.* | Copy as `curl` |

**Copy as curl** produces a command that runs, with the `Authorization` header
replaced by `$TOKEN` rather than the real token. A copied credential in a
reviewer's clipboard is a defect, not a feature.

### 3.9 `session` — diagnostics and the reuse demonstration

A small screen whose only purpose is to make the API's reuse detection visible.

| State | Trigger | Renders | The way out |
|---|---|---|---|
| `ready` | — | Token expiry counting down, the claims decoded as a table, and one action: **Replay a superseded refresh token**, with a paragraph explaining what is about to happen | Trigger it |
| `confirming` | The action | *This will end your session. The API revokes every token in the chain when it sees a replayed one.* | Confirm |
| `revoked` | The replay | The response shown in the inspector, then §2.4 with the reuse wording | Sign in |

### 3.10 `404`

Editorial density.

| State | Renders | The way out |
|---|---|---|
| `ready` | The path that was not found, in mono, and links to the directory and to sign-in depending on session state | Navigate |

### 3.11 `error-boundary`

The screen for a rendering failure, not an HTTP failure.

| State | Renders | The way out |
|---|---|---|
| `crashed` | *Something in the console failed to render.* The component stack in a code window in development, the error id only in production. **Reload** and a link to the repository's issues. | Reload |

The boundary sits below the app shell, so navigation survives a crash in a
feature.

### 3.12 `/_design` — the specimen route

Development only, excluded from the production build.

Every primitive from `ui/` in every state listed in this document, on one page,
in both densities. It is where the design is reviewed for the rest of the
project, and where a new state is drawn before it is wired to anything.

---

## 4. Focus and keyboard contract

Asserted in component tests, not left to review.

| Event | Where focus goes |
|---|---|
| Route change | The `h1` of the new screen, which is `tabindex="-1"` |
| Dialog open | The first interactive control, or **Cancel** for a destructive dialog |
| Dialog close | The control that opened it |
| Validation failure | The first invalid field |
| Row activation | The detail screen's `h1` |
| `Escape` | Closes the topmost dialog, then the inspector, then clears the search field |

Additional rules: every interactive element has a visible focus ring that is not
the browser default sitting invisibly on a black canvas; the table is traversable
with arrow keys once a row has focus; the inspector is reachable by keyboard from
the shell, not only by pointer; and nothing in the application is operable by
hover alone.

---

## 5. What lives in the URL

| Parameter | Screen | Example |
|---|---|---|
| `page` | directory | `?page=2` |
| `q` | directory | `?q=ovic` |
| `sort` | directory | `?sort=email:asc` |
| `status` | directory | `?status=locked` |
| `next` | sign-in | `?next=/users/7c41ab` |

Rules: an absent parameter means its default and is not written; an invalid
value falls back to the default rather than erroring; and changing a filter
resets `page` to 1, because keeping page 7 while changing the search term is the
most common paging bug there is.

What is deliberately **not** in the URL: the inspector's open state and
selection, which are per-session and would make every link carry debug state.

---

## 6. Screen to pull request

| Screen | PR |
|---|---|
| All primitives, all states | 3, 4 |
| `boot`, `sign-in` | 7 |
| `session-ended`, `refreshing` | 8 |
| `gated`, `session` | 9 |
| `users` and all its states | 10 |
| `users/:id`, `assign-role`, `lock-user` | 11 |
| `not-modified`, `conflict` | 12 |
| `inspector` | 13 |
| `404`, `error-boundary`, `cold-start`, `offline`, narrow viewport | 14 |

A pull request is not done until every state this document lists for its screens
either exists or is deferred by name in the PR's Notes.
