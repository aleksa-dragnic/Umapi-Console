# 0004 — Tokens have two tiers, and components may only reference the second

- **Status:** Accepted
- **Date:** 2026-09-19
- **PR:** #3

## Context

The console's visual language is defined by roughly thirty custom properties in
`docs/tokens.css`. Most of the rules that make the design coherent are rules
about *where* a value may appear rather than what it is: the violet accent
belongs to identifiers and never to a control, the status palette means the
class of an HTTP response and nothing else, two of the greys fail WCAG AA for
body text and may not carry it.

A flat token file cannot express any of that. `--color-graphite-hairline` tells
a reader what the colour looks like and nothing about where it is allowed, so
using it as a text colour produces a diff that looks entirely reasonable. The
rule exists only in a document, and the reviewer is expected to have memorised
it.

The same repository this console talks to shipped a documented architecture
rule that no test enforced and did not discover the violation for two weeks.
The cost of an unenforced rule is not that it is broken once; it is that nobody
can tell whether it currently holds.

There is also a second-source-of-truth problem. Contrast ratios have to be
computed from real values. If those values are copied into TypeScript so a test
can measure them, the stylesheet and the test can disagree, and the test will
keep passing against numbers that are no longer shipped.

## Decision

`docs/tokens.css` is two layers.

**Tier 1 is primitives**, named by what they are: `--color-iris-violet`,
`--color-graphite-hairline`, `--color-iron`. They carry the values. No
component references them.

**Tier 2 is semantics**, named by the job: `--color-fg-identifier`,
`--color-border-default`, `--color-fg-disabled`, `--color-status-4xx`. These
are what components use, through the Tailwind utilities generated from them.

A component that needs a colour not named in tier 2 needs a decision, not a hex
value. Adding a tier 2 token is an amendment to `docs/DESIGN-DECISIONS.md`; a
raw primitive or a literal colour in a component is a defect.

`src/lib/design/tokens.ts` holds the permission sets — which tokens may carry
body text, which are large-text and UI only, which are banned from text — and
holds **no values at all**. `src/lib/design/contrast.test.ts` reads
`docs/tokens.css` itself, resolves each semantic token through the primitive it
points at, and measures the result.

## Alternatives considered

### One flat tier, with the rules in prose

Fewer names and a shorter file. Rejected because the rules in sections 2, 3, 5
and 10 of the design decisions are all statements about where a colour may
appear, and a name like `--color-iron` cannot carry one. Enforcement would have
to inspect usage sites rather than names, which means a bespoke lint rule per
rule instead of a naming convention that makes the mistake visible in review.

### Values duplicated into TypeScript so the test can read them

The obvious way to write a contrast test, and how most design systems do it.
Rejected because it creates two places where `#6e727a` lives. The stylesheet is
what ships; a constant in a test file is a claim about the stylesheet, and
claims drift. Parsing the stylesheet costs about twenty lines and removes the
possibility entirely.

### Omitting `--color-charcoal` from the file rather than banning it

It measures 2.35:1 on the canvas and has no legitimate use as a foreground, so
deleting it would make misuse impossible. Rejected because it is a real value
in the visual language and will be wanted for a non-text purpose later. Keeping
it in tier 1 with no tier 2 name that exposes it is the same prohibition
expressed as a structure rather than an absence, and it survives someone
reintroducing the value from memory.

### A runtime check instead of a build-time one

Rejected as the wrong moment. A contrast violation discovered in the browser is
discovered by whoever happens to look; the same violation in CI is discovered
by the pull request that caused it.

## Consequences

**Easy.** A reviewer can see a violation in the diff without knowing the rules:
`text-fg-identifier` reads as a decision, a raw primitive name reads as a
mistake. Adding a colour forces the conversation about where it may be used,
because there is nowhere to put it otherwise.

**Hard.** Every new semantic token is two edits — the stylesheet and, if it
carries text, the permission set. A component that genuinely needs a one-off
colour cannot have one; it needs an amendment first. That friction is the
point, and it will occasionally be annoying.

**What has to stay true.** The contrast test resolves tokens by following
`var()` references, so a tier 2 token that stops pointing at a tier 1
primitive, or points at something that is not a colour, throws rather than
silently passing. If the stylesheet ever gains computed values —
`color-mix()`, `oklch()` — the parser has to grow with it or the test starts
skipping what it cannot read.

**Where it is enforced.**

- `src/lib/design/contrast.test.ts` — asserts the section 3 ratio table over
  the permission sets in `src/lib/design/tokens.ts`, on both the canvas and the
  lift surface, and asserts that no colour banned from text is reachable
  through any token in a text set. Verified by adding `--color-charcoal` to the
  body-text set: three tests fail.
- The verification block of each apply script — greps `src/` for a literal hex
  colour and for any tier 1 token name outside `src/lib/design/tokens.ts`.

The grep is the honest weak point: it is a step in a script rather than a lint
rule, so it runs when a script runs and not when someone edits a file by hand.
Promoting it to an ESLint rule is worth doing when `features/` exists and there
is more than one place to get it wrong.