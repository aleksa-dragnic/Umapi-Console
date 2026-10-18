# Instructions for coding agents

This repository is maintained with the help of AI coding agents (Claude Code).
The owner reviews every change. These instructions apply to any agent working
here; they restate rules the repository already follows.

## What this is

A React 19 single-page admin console for
[UserManagementAPI](https://github.com/aleksa-dragnic/UserManagementAPI),
served as static files from Cloudflare Pages, that shows every HTTP exchange it
makes. Start with `README.md`, `docs/architecture.md` and `docs/adr/README.md`.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev            # http://localhost:5173 against the mock in the browser
pnpm typecheck
pnpm lint           # zero warnings
pnpm format:check
pnpm test:run       # Vitest; pnpm coverage adds the floor
pnpm build && pnpm budget
pnpm test:e2e       # Playwright on the e2e build; needs the browsers installed
```

## Rules

- **English only**: code, comments, test names, commit messages, pull requests
  and documentation.
- **Follow `docs/BUILD-PLAN.md`**: Conventional Commits; one branch and one pull
  request per unit of work; pull request description in three parts, What / Why /
  Notes; squash merge.
- **Definition of done** is section 11 of the build plan.
- **A bug fix starts with a failing test.** Tests go through the DOM and the
  mock at the network layer (`docs/TESTING.md`); no mocked modules.
- **The mock follows the API as measured.** A handler cites the row of
  `docs/OBSERVED-BEHAVIOUR.md` it implements; a behaviour without a row is
  measured first, not guessed.
- **Every state is designed first.** A screen's states and copy come from
  `docs/SCREEN-INVENTORY.md`; change it in the same pull request.
- **Decisions are recorded.** A decision gets an ADR in the pull request that
  implements it; a departure from the plan gets a row in build plan section 14.
  An accepted ADR is not rewritten: it gets a dated section.
- **Documents must stay true.** Nothing is called enforced unless lint, a test
  or CI enforces it.

## Invariants (build plan section 10)

- No `memo`, `useMemo` or `useCallback`: the React Compiler memoises (ADR 0002).
- `ui/` imports no feature, no feature imports another, nothing imports `app/`,
  and production code does not import `@/lib/testing` (ADR 0003).
- Components use tier 2 tokens only; status colours only in `StatusDot.tsx` and
  `Inspector.tsx` (ADR 0004).
- Nothing in `src/` touches `localStorage` or `sessionStorage`; the access token
  lives in memory (ADR 0007).
- The production bundle carries no mock and no specimen route (ADR 0012).

## Do not

- Commit secrets, tokens or credentials. Nothing in a `VITE_` variable is
  secret, because it ends up in the bundle.
- Edit `src/lib/api/schema.d.ts` by hand; run `pnpm api:generate`.
- Change dependency versions outside a dependency update; versions are exact,
  and a version must be a day old (`pnpm-workspace.yaml`).
- Rewrite history, force-push `main`, or push to `main` without a pull request.
