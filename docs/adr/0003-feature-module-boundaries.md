# 0003 - Feature-module boundaries enforced by lint rather than convention

- **Status:** Accepted
- **Date:** 2026-09-18
- **PR:** #1

## Context

The CV this project supports claims feature-module architecture. Folders named
after features prove nothing; every codebase has those, and most of them import
freely across the lines the folder names imply.

The API repository this console talks to spent two weeks with a documented
architecture rule that no test enforced. The rule was true when it was written
and false a month later, and nobody noticed because nothing failed. That is the
specific failure this decision is written against.

## Decision

Four layers, with imports pointing one way only:

- `ui/` knows design tokens and nothing else
- `features/` may import from `lib/` and `ui/`
- `app/` composes features
- nothing imports back up, and no feature imports another feature

Cross-feature needs go through `app/` or `lib/`.

## Alternatives considered

### A documented convention reviewed by hand

What the API repository did. Rejected on evidence: it did not hold there, and
this repository has the same single reviewer.

### A monorepo with one package per feature

Would make the boundaries real at the package-manager level rather than the lint
level, and would fail at install time instead of at lint time. Rejected as
equipment that outweighs the job for three features and one developer.

### Path-based import rules via `tsconfig` paths alone

Aliases make imports shorter but do not forbid anything; `@/features/auth` is
just as importable from `@/ui` as a relative path would be.

## Consequences

Adding a feature means adding a boundary entry, which is a visible step rather
than a thing to remember.

A genuine cross-feature need becomes a deliberate move into `lib/` or `app/`,
recorded in the pull request, instead of an import that nobody sees.

Enforcement lands with the directories themselves in PR 3. The rule will be
`no-restricted-imports` with path patterns per layer, because the ESLint
configuration here has no import-resolver plugin and adding one only to express
this rule would be equipment that outweighs the job. At PR 1 `ui/` and
`features/` do not yet exist, so the rule is stated here and asserted there -
and this sentence exists so that the gap is on the record rather than assumed
closed.