# Testing

How the console is tested, what each layer is for, and the rules every test
follows. The strategy itself is section 9 of [the build plan](BUILD-PLAN.md);
this is the practical guide.

## The layers

| Layer | Where | Runs with | Against |
|---|---|---|---|
| Unit and component | `src/**/*.test.ts(x)`, beside the code | Vitest 5 in jsdom, Testing Library | The mock (MSW) at the network layer |
| End to end | `e2e/*.spec.ts` | Playwright, on a production build in the `e2e` mode | The mock, in a service worker (ADR 0012) |
| Accessibility | `e2e/a11y.spec.ts` | Playwright with `@axe-core/playwright` | The same build; WCAG 2.2 A and AA |
| Contract | CI job `contract` | `pnpm api:generate` and a diff | The deployed OpenAPI document |
| Live | `e2e/live/*.spec.ts` | Playwright, `playwright.live.config.ts` | The deployed console and API |

On 2026-10-18: 414 unit and component tests in 53 files; 24 end-to-end tests
in 9 specs, run as 42 because the smoke and accessibility specs also run in
Firefox and WebKit; 3 live tests.

## Commands

```bash
pnpm test           # Vitest in watch mode
pnpm test:run       # Vitest once
pnpm coverage       # Vitest once, with the coverage floor (vite.config.ts)
pnpm test:e2e       # Playwright: builds the e2e bundle, serves it, runs every project
pnpm test:live      # Playwright against the deployed pair - by hand only
```

`pnpm test:e2e` needs the browsers once: `pnpm exec playwright install chromium
firefox webkit`. To run Chromium alone, `pnpm test:e2e --project=chromium`.

## In CI

- `build-and-test` (required): typecheck, lint at zero warnings, Prettier,
  `pnpm audit --audit-level high`, `pnpm coverage`, the production build, the
  bundle budget, and a search of `dist/assets` that fails if the mock or the
  specimen route reached the production bundle.
- `e2e` (required): every spec in Chromium, the smoke and accessibility specs
  in Firefox and WebKit. A failed run uploads its traces.
- `contract` (not required): on every pull request, every push to `main` and
  weekly. It is not required because the document lives on a free instance that
  can be asleep or down, and a merge does not wait on it (ADR 0006).
- `audit` (weekly and on demand, not on pull requests, where `build-and-test`
  already runs it): `pnpm audit --audit-level high` alone, so an advisory
  published between pushes is a red run on `main` (#60).
- `web-vitals` (weekly and on demand, not on pull requests): Lighthouse 13 on
  its default mobile profile against sign-in, the directory and a user's
  detail, signed in as the demo account, through
  `playwright.lighthouse.config.ts` (`pnpm test:vitals`). Budgets: LCP
  ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms, the thresholds of "good" Core Web Vitals.
  The measured values are kept as the `web-vitals` artifact (#63).
- `visual` (on pull requests, not required): `pnpm test:visual`, screenshots
  of the specimen route's 14 sections in both densities, 28 in all, compared
  with `e2e/visual/__screenshots__` at a 0.2 % pixel tolerance, Chromium only.
  A failure uploads the expected, actual and diff images (#64).
- `analyze` (CodeQL, not required).
- `headers` (its own workflow, weekly and on demand): what Cloudflare Pages
  serves, compared with `public/_headers`. Not on pull requests, because a pull
  request has not changed the deployed site yet.

`e2e/csp.spec.ts` is the one spec that runs the console under its own Content
Security Policy, Trusted Types included: `vite preview` does not read
`public/_headers`, so the spec puts the policy on the document itself.

The live suite never runs in CI. It depends on a free instance waking, shares
the demo account with every visitor, and spends nine of the auth limit's ten
requests a minute (build plan section 9).

## The mock

`src/lib/testing/` is a mock of the API written from
[OBSERVED-BEHAVIOUR.md](OBSERVED-BEHAVIOUR.md): every handler cites the row it
follows, and a behaviour the mock relies on has a row. Unit tests reach it
through MSW's Node server (`src/lib/testing/server.ts`); the dev server and the
`e2e` build through a service worker. A spec changes the scenario through
`window.__umapiMock` (`e2e/support.ts`): a refresh race, an answer for the next
matching request (`respondOnce`), or a cold start set before the page loads.
The production bundle never contains any of it.

jsdom has no `showModal()`, so `src/lib/testing/dialog.ts`, installed in
`setupTests.ts`, stands in for it in unit tests: it opens and closes a
`<dialog>` and turns Escape into the `cancel` event. It does not emulate the
top layer or the inert page behind a modal; `e2e/a11y.spec.ts` proves those in
all three browsers (#61).

user-event follows Enter to a submit button inside the form only, not to one
tied to it by the `form` attribute, as the register dialog's **Register** is.
Browsers do follow it, so `e2e/a11y.spec.ts` submits that dialog by Enter in
all three.

## Rules

- Test behaviour through the DOM as a user meets it: roles, names, text. No
  assertions on component internals, no snapshots of markup.
- MSW, not mocked modules, so the code under test makes real HTTP calls and
  the transport is exercised.
- Every bug fix starts with a failing test.
- A new state on a screen gets a test, and the accessibility spec checks it if
  a visitor can meet it.
- Coverage is a diagnostic, not a target. The floor catches a drop; it is not
  raised to chase a number.
- Vitest counts each `.each` row as a test. State the expected count before a
  run that changes it.

## Web Vitals

Measured 2026-11-24 on a Windows workstation, Lighthouse 13.6, default mobile
profile, production build with the mock; the directory and the detail signed
in, in the tab Lighthouse navigates (#80):

| Screen | LCP before ADR 0017 | LCP after | CLS | TBT |
|---|---|---|---|---|
| sign-in | 3.24 s, over the 2.5 s budget | **0.76–0.78 s** | 0 | 17–32 ms |
| directory, signed in | 1.69 s | 1.69–1.70 s | 0.01 | 21–115 ms |
| detail, signed in | 1.68 s | 1.69 s | 0 | 17–21 ms |

Sign-in waited for the session check behind the boot screen; since ADR 0017 a
browser without a session sees it at once (#76). The directory and the detail
still wait for the check, on purpose.

**A correction.** The first numbers recorded here for the directory and the
detail (1.68–1.74 s) were sign-in's after a redirect: Lighthouse opened a tab
of its own, where the mock had no session. #80 measures in one tab and fails
when the page measured is not the page asked for.

TBT moves by a factor of five between runs, which is why the job is not a check
on pull requests.

## Visual baselines

The specimen screenshots depend on the platform's fonts and rendering, so the
baselines are made in the Playwright image CI uses, never on a workstation.
After an intended visual change, a changed token or primitive, regenerate
them and review the PNG diff before committing it:

```bash
bash scripts/update-specimen-snapshots.sh
```

The script copies the working tree into
`mcr.microsoft.com/playwright:v<version>-noble` (the version in
`package.json`), installs there, runs the specimens with `--update-snapshots`
and copies `e2e/visual/__screenshots__` back. When Dependabot moves
`@playwright/test`, the baselines are regenerated in the same pull request.
The clock is frozen right after the page renders, and the test checks that
the rate-limit notices still show their starting value, so a slow machine
fails clearly instead of producing a screenshot of the wrong second.

