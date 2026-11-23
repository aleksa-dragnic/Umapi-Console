## What

One or two sentences.

## Why

The reasoning. Link the ADR if this implements a decision.

## Notes

Trade-offs, anything deliberately left out, anything the next pull request picks
up. For a bug fix: the test that failed first.

## AI assistance

<!-- Exactly one. docs/AI-WORKFLOW.md says what each means. -->

- [ ] none
- [ ] drafted (an agent wrote a first version; I reviewed and changed it)
- [ ] reviewed-by-agent (I wrote it; an agent reviewed it)

**What I verified myself:**

<!-- What you checked by hand, not what CI ran: the tests' assertions read,
     the screen at 375 px, a keyboard pass, a failure provoked through the mock. -->

<!--
Definition of done (docs/BUILD-PLAN.md section 11):
- Typecheck, lint, unit tests and build pass
- New behaviour is covered at the appropriate level
- Every state the inventory lists for a touched screen is implemented, or deferred in the Notes
- Mocked behaviour cites a row of docs/OBSERVED-BEHAVIOUR.md
- No design token outside its documented role
- Keyboard reachable, focus visible and placed after every transition
- No any, no @ts-expect-error without a reason
- The description explains why, not only what
- An ADR exists if this implements a decision
-->
