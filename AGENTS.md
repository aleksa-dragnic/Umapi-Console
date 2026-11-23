# AGENTS.md

Instructions for a coding agent working in this repository. A person can read
them too: they are the same rules the maintainer works to. How the agent and the
maintainer divide the work is in [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md),
and the decision behind it is
[ADR 0016](docs/adr/0016-working-with-a-coding-agent.md).

When these instructions and the code disagree, the code is the current state and
this file is out of date. Say so in the pull request rather than guessing which
one is right.

## What this is

An admin console for [UserManagementAPI](https://github.com/aleksa-dragnic/UserManagementAPI)
that does not hide HTTP: every request is in the inspector, a 304 says 304, a
refused write says which permission it needed. A Vite SPA with React 19 and
TypeScript, served as static files from Cloudflare Pages, talking to the API
directly.

Read before changing anything:

1. [`docs/architecture.md`](docs/architecture.md): layers and the path of a
   request
2. [`docs/adr/README.md`](docs/adr/README.md): the decisions; do not reopen one
   without saying so
3. [`docs/SCREEN-INVENTORY.md`](docs/SCREEN-INVENTORY.md): every screen and
   state, with its copy, before touching a screen
4. [`docs/OBSERVED-BEHAVIOUR.md`](docs/OBSERVED-BEHAVIOUR.md): what the API was
   measured to do, before touching the mock or a request
5. [`docs/TESTING.md`](docs/TESTING.md) and
   [`docs/DESIGN-DECISIONS.md`](docs/DESIGN-DECISIONS.md)

## Layout

```
src/
├── app/         routes, providers, the shell, the error boundary
├── features/    auth, users, inspector: one folder per feature
├── lib/         api (clients, refresh, problem details), design, testing (the mock)
└── ui/          components on design tokens only
e2e/             Playwright specs
```

Imports point one way: `app` → `features` → `lib`, and everything may use `ui`.
`ui` imports no feature, no feature imports another, and production code never
imports `@/lib/testing`. ESLint enforces each of these (ADR 0003).

## Commands

Node and pnpm come from `.nvmrc` and `packageManager`.

```bash
pnpm install
pnpm dev               # http://localhost:5173 against the in-browser mock

pnpm typecheck
pnpm lint              # zero warnings allowed
pnpm format:check
pnpm audit --audit-level high
pnpm coverage          # unit and component tests, held to the coverage floor
pnpm build
pnpm budget            # production JavaScript at most 140 kB gzipped

pnpm exec playwright install chromium firefox webkit   # once
pnpm test:e2e          # production build with the mock, every browser project
pnpm test:e2e --project=chromium

pnpm api:generate      # regenerate src/lib/api/schema.d.ts from the deployed API
```

`build-and-test` in `.github/workflows/ci.yml` runs typecheck, lint, format,
audit, coverage, build and budget, then checks that `dist/assets` holds neither
the mock nor the specimen route. `e2e` runs in the official Playwright image,
which must match `@playwright/test` in `package.json`. `pnpm test:live` runs
against the deployed pair and is the maintainer's, by hand only.

## Conventions

- **Screens follow the inventory.** Every state `docs/SCREEN-INVENTORY.md` lists
  for a screen is implemented, or deferred by name in the pull request.
- **The mock follows the observations.** A behaviour the mock relies on cites
  its row in `docs/OBSERVED-BEHAVIOUR.md`; a behaviour without a row gets one
  measured first.
- **API types are generated, never edited.** `src/lib/api/schema.d.ts` comes
  from `pnpm api:generate` (ADR 0006).
- **Server state goes through TanStack Query; collection state lives in the
  URL**; there is no state library (ADR 0010, ADR 0011).
- **Tokens**: components use tier 2 tokens only; no literal colour, no Tailwind
  default palette (ADR 0004, `src/lib/design/usage.test.ts`).
- **No manual memoisation**: the React Compiler is on, and `memo`, `useMemo`
  and `useCallback` are refused by lint (ADR 0002).
- **No `any`**, and no `@ts-expect-error` without a comment naming the reason.
- **The access token never touches storage**: `localStorage` and
  `sessionStorage` are refused by lint outside tests (ADR 0007).
- **Tests** follow `docs/TESTING.md`: through the DOM by role and name, MSW
  rather than mocked modules, a bug fix starts with a failing test. State the
  expected test count before a run that changes it.

## Git and pull requests

- One branch per unit of work: `feat/...`, `fix/...`, `docs/...`, `ci/...`.
- Conventional Commits: `type(scope): imperative subject`, and a body that says
  why.
- Every commit an agent wrote or co-wrote ends with
  `Co-Authored-By: Claude <noreply@anthropic.com>`.
- The pull request follows `.github/pull_request_template.md`, including the AI
  assistance section. Pull requests are squash-merged.

## Definition of done

Before saying a change is done, the agent has run, and reports with their
output:

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm coverage`,
      `pnpm build` and `pnpm budget`
- [ ] `pnpm test:e2e` for a change a visitor can see, at least in Chromium; the
      browsers that were not run are named
- [ ] every interactive element it adds is reachable and operable by keyboard,
      with visible focus, and the accessibility spec covers any new state
- [ ] the documents the change makes wrong are corrected in the same pull
      request (README, `docs/`, Known limits)

A failing check is reported as failing, with its output. Never claim a result
that was not run.

## What the agent does not do

- **No history rewriting.** No force push, no rebase or amend of a pushed
  commit, never on `main`.
- **No merge, no closing a pull request or issue, no deleting a branch** without
  the maintainer's explicit go-ahead for that specific item.
- **No decisions recorded as made.** Architecture decisions and ADRs are the
  maintainer's. The agent may propose one and draft its text; the maintainer
  decides and sets its status.
- **No change to security design on its own initiative**: token handling, the
  refresh flow, permission gates, `public/_headers` and the Content Security
  Policy. Work there follows a plan the maintainer wrote, and the maintainer
  reads every line and the assertions of its tests.
- **No secrets**, and nothing private in a `VITE_*` variable: those are
  inlined into the public bundle.
- **No repository or hosting settings**: branch protection, Cloudflare Pages,
  GitHub secrets. Those stay with the maintainer.
- **No weakening a check to get green**: no skipped test, no lowered coverage
  floor or budget, no disabled lint rule, no `--no-verify`, without saying so
  and why in the pull request.
