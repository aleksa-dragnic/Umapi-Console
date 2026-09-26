# 0009 - What the interface offers is read from the access token's claims, in `lib/`

- **Status:** Accepted
- **Date:** 2026-09-26
- **PR:** #11

## Context

The API decides access on every request. The console decides only what to
offer: which controls are live, which carry a reason, which routes render. It
needs a source for that which says what the API will allow this token to do.

Three sources are available, and two of them are wrong. The account's role name
("Member", "Administrator") is not in the token at all - row 4 measured no role
claim - and a role's permissions are the API's to change. The HATEOAS links are
unfiltered: the API sends write links to the demo account, and both `lock` and
`unlock` for an active user (row 33). The third is the token's `permission`
claim, which lists exactly what the API checks: a JSON array, or a string when
the account holds one permission (row 4).

The build plan placed permission gates in `features/auth/` (section 4.2). The
first screen with real actions, the user detail in PR 13, belongs to
`features/users/`, and one feature may not import another (ADR 0003).

## Decision

Permissions come from the access token's `permission` claim and from nothing
else. The payload is decoded in the browser without verifying the signature: the
console is not where access is decided, and a forged token would only change
what the interface offers to a user whose every request the API still refuses.
A token that cannot be read yields no claims, and permits nothing.

The decoding and the question live in `src/lib/api/`: `claims.ts` reads the
payload, `permissions.ts` holds the five permissions of row 48, `useCan`, and
`gateReason` - the sentence inventory section 2.6 prescribes. The access token
store in `access-token.ts` is observable, so `useCan` follows every change of
token - a sign-in, a refresh, a session ended - without going through the
session provider, which remains the owner of the session.

A control the token does not permit is rendered disabled with its reason,
never hidden. A route the token does not permit renders the same reason in
place, through `RequirePermission`, which stays in the auth feature because it
is a route and `app/` composes it.

## Alternatives considered

### Keeping it in the auth feature

The plan's placement. Rejected: `features/users/` could not ask, except through
props threaded from `app/` into every screen that has an action.

### Permissions from role names

Readable, and what a hand-written console would do. Rejected: the token carries
no role claim (row 4), and a role's permissions change without the console
knowing.

### Permissions from HATEOAS links

What the links are for, in principle. Rejected: the API does not filter them by
permission (row 33), so every action would appear available to every account.

## Consequences

Every feature asks the same function, and a new feature needs nothing from the
auth feature to gate its actions. The claim's array order is the API's, so the
reason lists the permissions held in row 48's order instead.

Enforced by `src/lib/api/claims.test.ts` (array, string, unreadable),
`src/lib/api/permissions.test.ts` (the reason's wording),
`src/features/auth/RequirePermission.test.tsx`, and
`src/features/auth/gated-action.test.tsx`, which is Gate 3's row: a gated
action is `aria-disabled`, states its reason, and sends nothing.
