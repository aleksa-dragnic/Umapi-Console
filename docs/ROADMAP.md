# Roadmap

What the console deliberately does not do yet, and what each would take. None
of it is planned work; starting one begins with an issue and, where it needs a
decision, an ADR ([`AI-WORKFLOW.md`](AI-WORKFLOW.md)). What the API itself
defers is in its own
[roadmap](https://github.com/aleksa-dragnic/UserManagementAPI/blob/main/docs/ROADMAP.md).

## Features that wait on the API

| Idea | What it would take |
|---|---|
| **Deactivating a user** | The API's domain has the transition but no endpoint yet. A confirmation dialog on the detail, like lock and unlock (inventory section 3.6), gated by `users.write`, and a `deactivated` row in the history panel. |
| **Email verification** | The API needs an email provider first. The console's part is small: the `Pending` status already renders, and a resend action would sit beside it on the detail. |

## The console itself

| Idea | What it would take |
|---|---|
| **Narrow screens that wrap** | Tables scroll sideways at 375 px. The directory would become a list of cards below the `md` breakpoint, with the same columns as labelled rows. |
| **The countdown on the Session screen's race** | A run of 429s there reads as "unexpected". The shared `Retry-After` countdown (inventory section 2.7) that boot and sign-in show would be reused. |
| **A refused sign-out** | The cookie stays valid, so a reload restores the session. The console would say so and offer to try again, instead of looking signed out. |
| **`X-Correlation-Id` in the mock** | The inspector shows it only against the API. The mock would mint one per response, as the API does. |
| **Values in the history** | The panel says that a field changed, not from what to what, because the API's audit log keeps names only (its ADR 0025). Showing values starts in the API. |

## The maintainer's, outside the code

| What | Where it stands |
|---|---|
| **Registration and history, measured live** | The mock follows the API's source and tests. Measuring needs an administrator session; the probes are listed under "Still to measure" in [`OBSERVED-BEHAVIOUR.md`](OBSERVED-BEHAVIOUR.md). |
