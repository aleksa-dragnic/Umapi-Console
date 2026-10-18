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
