# Working with a coding agent

How changes to this repository are made with an AI coding agent (Claude Code),
what is delegated to it and what is not, and how its work is checked. The
decision is [ADR 0016](adr/0016-working-with-a-coding-agent.md), the same one
UserManagementAPI records as its ADR 0022; the rules the agent itself reads are
in [`AGENTS.md`](../AGENTS.md).

## The flow

```
issue  ->  plan  ->  branch  ->  agent draft  ->  review  ->  CI  ->  merge
```

1. **Issue.** Every unit of work starts as an issue with a "Done when" list,
   in a milestone.
2. **Plan.** Before any code, the agent reads the issue, the ADRs and the
   inventory rows it touches and the code, and writes a short plan: the files,
   the states, the tests, what is left out. The maintainer accepts it, changes
   it or rejects it. A plan that needs a new decision stops here until the
   decision is made, as an ADR.
3. **Branch.** One branch per issue.
4. **Agent draft.** The agent implements the plan with its tests, runs the
   checks, and opens the pull request with the template filled in, including
   what it ran and what it could not.
5. **Review.** The maintainer reads the diff on GitHub, and for anything a
   visitor sees, runs it: `pnpm dev` against the mock, a keyboard pass, the
   narrow width.
6. **CI.** `build-and-test` and `e2e` in three browsers, `contract` against the
   deployed API, CodeQL. Red is fixed, not retried until green.
7. **Merge.** The maintainer squash-merges. A release, a tag and the deploy are
   the maintainer's alone.

## What is delegated and what is not

| Delegated to the agent | Kept by the maintainer |
|---|---|
| Components and screens inside the inventory and the visual system | Architecture decisions, and accepting their ADRs |
| Unit, component and end-to-end tests | The assertions of tests on tokens, refresh and permission gates |
| Mock handlers written from `OBSERVED-BEHAVIOUR.md` rows | Measuring the API and writing those rows |
| Refactoring where tests already cover the behaviour | The design of anything security-sensitive: token handling, the refresh flow, permission gates, `public/_headers` |
| Documentation, kept true to the code | The visual system: tokens, type, the decisions in `DESIGN-DECISIONS.md` |
| Dependency triage and CI diagnosis | Merging, releasing, deleting branches, closing issues and pull requests |
| Drafting issues, pull request descriptions and ADR text | Cloudflare Pages, repository settings and every secret |

The agent can draft in any area. It can change the kept ones only from a plan
the maintainer wrote, and only in a pull request the maintainer reads line by
line.

## How a change is verified

The agent's report is where checking starts, not where it ends.

- **The agent runs, and shows.** Every pull request lists the commands it ran
  and their results, and the browsers it did not run.
- **CI runs the same checks again** on a clean runner, in the Playwright image,
  in three browsers.
- **The maintainer reads the tests first**: that each would fail without the
  change, and that it finds elements by role and name as a visitor would.
- **Claims are checked against the code.** A document that says "enforced" has
  to point to the test, lint rule or CI step that makes it so (build plan
  section 10).
- **The pull request records it.** The template's AI assistance section says
  how the change was made, and "What I verified myself" lists what the
  maintainer checked by hand: a screen at 375 px, a keyboard pass, a request in
  the inspector, a failure provoked through the mock. Pull requests before #70
  predate the template's AI assistance section.

## Marking the work

- A commit the agent wrote or co-wrote ends with
  `Co-Authored-By: Claude <noreply@anthropic.com>`.
- The pull request's AI assistance is one of:
  - `none`: written without an agent
  - `drafted`: the agent wrote a first version, the maintainer reviewed and
    changed it
  - `reviewed-by-agent`: the maintainer wrote it and an agent reviewed it
- Commits before ADR 0016 do not carry the trailer; the history is not
  rewritten to add it.
