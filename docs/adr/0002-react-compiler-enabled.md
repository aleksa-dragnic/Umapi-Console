# 0002 - The React Compiler is enabled, and manual memoisation is a defect

- **Status:** Accepted
- **Date:** 2026-09-18
- **PR:** #1

## Context

The React Compiler reached 1.0 and is no longer experimental. Enabling it is not
a build flag; it is a decision about how performance work is done in this
codebase for the rest of its life. The failure mode is not "the compiler is
slow", it is a codebase that runs the compiler and still hand-memoises, where
neither mechanism can be reasoned about because both are present.

This application has two places where manual memoisation would otherwise
accumulate. The user directory renders a table of up to fifty rows that refetches
on every query-string change, and the inspector holds a growing list of captured
requests that updates while the user is reading it. Both are exactly the shape
that invites a `useMemo` added under time pressure and never removed.

## Decision

`babel-plugin-react-compiler` is enabled in `vite.config.ts` through
`@vitejs/plugin-react`, targeting React 19.

`memo`, `useMemo` and `useCallback` are not used in `src/`. A component that
appears to need one needs a profiler measurement and an amendment to this ADR,
not a wrapper.

## Alternatives considered

### The compiler off, manual memoisation where the profiler says so

The conservative choice, and defensible. Rejected because it makes every
performance question a judgement call at review time, and because the memoisation
that ends up in most React codebases is not the memoisation a profiler asked for.

### The compiler on, manual memoisation still allowed

Rejected outright. Two mechanisms doing the same job means neither can be
reasoned about, and the compiler's own output becomes unpredictable when it meets
hand-written memo boundaries.

### The compiler in annotation mode, opted into per file

Would allow a gradual rollout. Rejected because this repository starts empty -
there is no existing code to migrate, so the gradual path buys nothing and leaves
two conventions in one codebase.

## Consequences

Performance work in this codebase means measuring and changing the shape of the
data or the component tree, not adding wrappers.

The compiler runs inside the existing oxc transform rather than adding a
separate Babel pass, so the cost is a peer dependency pinned to a single
release rather than a second transformer in the build.

Enforced by a grep in the PR verification block: `useMemo`, `useCallback` and
`memo(` do not appear in `src/`. It is a grep rather than a lint rule because the
rule that would express this properly was not verified to exist in
`eslint-plugin-react-hooks` at the version pinned here. Replacing the grep with a
lint rule is a follow-up, and until then this is honestly an enforced convention
rather than a type-aware check.