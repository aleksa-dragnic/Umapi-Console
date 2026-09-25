# Observed behaviour of the deployed UserManagementAPI

Measured, not read from a README. Every MSW handler branch cites a row here by
its number. Filled in at Gate 0 and committed in PR 6, before any mock is
written - see `docs/BUILD-PLAN.md` section 8.

Instance: `https://usermanagementapi-j1if.onrender.com`, API `main` at
`c182399` (`v1.0.1`). Probes run from Windows PowerShell 5.1 on 2026-09-23 and
2026-09-25, with the demo account unless a row says otherwise.

A row describes the API **as deployed today**. Where the console's contract
deliberately differs - the refresh token moving into a cookie in M5 - the row
says so, and the mock implements the contract, not the row.

Rows 43-55 are different in kind: they were **read from the API's source**,
not measured. The source says what the code intends; only the deployed instance
says what happens. A source-read row is enough to design against, and each one
names the probe or the M5 step that confirms it live.

## Authentication and session

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 1 | Login returns tokens and absolute expiries | `POST /api/v1/auth/login` `{email, password}` | 200. Body fields exactly `accessToken`, `accessTokenExpiresAtUtc`, `refreshToken`, `refreshTokenExpiresAtUtc`. Expiries are ISO 8601 UTC strings, not durations. The refresh token is in the body today; M5 moves it into the `umapi_rt` cookie and removes both refresh fields from the body. | 2026-09-23 |
| 2 | Access token lifetime | Decode `exp` and `iat` of the token from row 1 | `exp - iat` = 900 s (15 minutes) | 2026-09-23 |
| 3 | Refresh token lifetime | `refreshTokenExpiresAtUtc` against the login time | 7 days | 2026-09-23 |
| 4 | Access token claims | Decode the payload | `aud` and `iss` = `usermanagementapi`, `sub` = user id, `email`, `jti`, `nbf`, `iat`, `exp`, and `permission` - a JSON array for the demo account: `users.read`, `roles.read`. No name claim, no role claim. A single-permission account would serialise `permission` as a string, so the decoder accepts `string \| string[]`. | 2026-09-23 |
| 5 | Wrong credentials do not reveal whether the account exists | `POST /auth/login` with an unknown email, and with the demo email and a wrong password | Both 401 with identical bodies apart from `traceId`: `errorCode` `Auth.InvalidCredentials`, `detail` "The email or password is incorrect." Response time was not compared. | 2026-09-23 |
| 6 | Refresh rotates the token | `POST /api/v1/auth/refresh` `{refreshToken}` | 200. Same four body fields as row 1. The returned refresh token differs from the one sent. | 2026-09-23 |
| 7 | Replaying a superseded refresh token is detected | Refresh with the token already exchanged in row 6 | 401, `errorCode` `Auth.RefreshTokenReused`, `detail` "The refresh token was already exchanged. Every session for this account has been revoked." | 2026-09-23 |
| 8 | Revocation covers every session of the account, not one chain | Refresh with the current token from row 6, after row 7 | 401, `errorCode` `Auth.InvalidRefreshToken`, `detail` "The refresh token is not valid." | 2026-09-23 |
| 9 | Access tokens survive revocation until they expire | `GET /api/v1/users` with the access token issued in row 6, after row 7 | 200. Access tokens are not checked against revocation; the session ends at the client, or at the next refresh. | 2026-09-23 |
| 10 | An expired access token | Any authenticated request after `exp` | 401, framework problem details (see row 34), header `WWW-Authenticate: Bearer error="invalid_token", error_description="The token expired at '<timestamp>'"` | 2026-09-23 |
| 11 | Two concurrent refreshes with the same token | Two `POST /api/v1/auth/refresh` `{refreshToken}` with the same token, sent together through one `HttpClient`; three rounds, each after a fresh login | Every round: one 200 and one 409 `Concurrency.Conflict`, and the winner's new token then refreshed with 200 - nothing revoked. Never two 200s. The other outcome row 46 allows, 401 `Auth.RefreshTokenReused` with every session revoked, did not occur: requests that leave together read the same row and collide on the write, while the 401 needs the loser to read after the winner has committed. | 2026-09-25 |

## The user directory

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 12 | List body is a bare array | `GET /api/v1/users` | 200. JSON array of `{id, email, firstName, lastName, status}`. Pagination is in a header only. | 2026-09-23 |
| 13 | `X-Pagination` contents | Any list request | JSON: `currentPage`, `totalPages`, `pageSize`, `totalCount`, `hasPrevious`, `hasNext`, camelCase | 2026-09-23 |
| 14 | Default page size | `GET /users?pageNumber=1` | `pageSize` 10 in `X-Pagination` | 2026-09-23 |
| 15 | Page size is clamped, not refused | `GET /users?pageSize=500` | 200, `pageSize` 50 | 2026-09-23 |
| 16 | Sorting is applied | `orderBy=email asc`, then `orderBy=email desc` | 200 both, order reverses. The format is `<field> <direction>` with a space. | 2026-09-23 |
| 17 | An unknown sort field is ignored silently | `orderBy=nonsense` | 200, default order. A client cannot discover the whitelist by probing; it comes from the API's contract. | 2026-09-23 |
| 18 | Status filter values and casing | `status=Locked`, `status=locked` | 200 both. Accepted values: `Pending`, `Active`, `Locked`, `Deactivated`, case-insensitive. | 2026-09-23 |
| 19 | An unknown status is a validation error | `status=nonsense` | 422, `errorCode` `Validation.General`, `errors: { "Status": ["Status must be one of: Pending, Active, Locked, Deactivated."] }`. The key is PascalCase while the query parameter is lowercase, so field matching is case-insensitive. | 2026-09-23 |
| 20 | Production data | `GET /users?pageSize=50` | Two users, both Active: `admin@umapi.local`, named System Administrator, and `demo@umapi.local`, named Demo Reader. The names are first and last name, not roles: the demo user's one role is `Member` (read 2026-09-25). | 2026-09-23 |
| 21 | v1 detail body | `GET /api/v1/users/{id}` | 200. `id`, `email`, `firstName`, `lastName`, `status`, `roles[]` of `{roleId, name, assignedAtUtc}`, `createdAtUtc`, `updatedAtUtc`. **No version field in the body.** | 2026-09-23 |
| 56 | Search, live | `GET /users?searchTerm=<t>` for `admin`, `ADMIN`, `system`, `reader`, `umapi`, `zzz`, `demo reader` | 200 for every term. Case-insensitive: `ADMIN` finds what `admin` finds. Matches the email (`umapi` finds both users) and each name field (`system` finds the administrator, `reader` the demo user; neither word is in an email). No match is 200 with an empty array and `totalCount` 0; `X-Pagination` follows the filter. **A term spanning two fields matches nothing**: `demo reader` finds no one, because each field is compared on its own. Diacritics cannot be measured on two users. | 2026-09-25 |

## Caching and concurrency

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 22 | List responses carry a weak ETag | `GET /users?pageNumber=1` | `ETag: W/"..."`, `Vary: Accept,Accept-Encoding`, `Cache-Control: private, no-cache`. The API generates a **strong** tag (row 44); the `W/` is most likely added by the edge in front of it when it compresses the body (row 39). `If-None-Match` still works because the API compares weakly. | 2026-09-23 |
| 23 | Conditional GET on the list | Repeat with `If-None-Match: <etag>` | 304, empty body | 2026-09-23 |
| 24 | Conditional GET on the detail | `GET /users/{id}`, repeat with `If-None-Match` | 200 with a weak ETag, then 304 with an empty body | 2026-09-23 |
| 25 | The ETag changes after a write | As administrator, `PUT /api/v1/users/{id}` changing the demo user's last name, then `GET` of the detail and of the list's first page; reverted afterwards | Both tags change, the detail's and the list's. The tag is a hash of the body (row 44), so any visible change moves it. | 2026-09-25 |
| 26 | How a concurrent write is detected | Read from the source | **It is not.** Users carry no concurrency token and the API reads no `If-Match` (row 45): a stale profile edit silently overwrites a newer one. The ETag is a cache validator only. | source |
| 57 | An update answers 204 with no body | `PUT /api/v1/users/{id}` `{email, firstName, lastName}` as administrator | 204, empty body: neither the saved record nor its new `ETag`. A client that needs either reads the detail again. | 2026-09-25 |

## Authorisation and limits

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 27 | The demo account cannot write | `POST /api/v1/users` as demo, with an invalid body | 403, framework problem details (row 34). Authorisation runs before validation: the invalid body did not produce a 422. | 2026-09-23 |
| 28 | Login is rate limited | Eleven `POST /auth/login` inside a minute, unknown email | Attempts 1-10 are 401, attempt 11 is 429 with `Retry-After: 60` (seconds, not an HTTP date). The partition key for anonymous requests was not established. | 2026-09-23 |
| 29 | Oversized body | `POST /auth/login` with a 300 KB body | 413. Measured on an anonymous endpoint: on an authenticated write, authorisation answers first. | 2026-09-23 |

## Versioning and media types

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 30 | Supported versions are advertised | Any versioned response | `api-supported-versions: 1.0, 2.0` | 2026-09-23 |
| 31 | v2 detail | `GET /api/v2/users/{id}` | 200. `id`, `email`, `displayName`, `status` only - no roles, no timestamps. The console uses v1. | 2026-09-23 |
| 32 | An unsupported version | `GET /api/v3/users/{id}` | 404, answered before authentication (an expired token still got 404) | 2026-09-23 |
| 33 | HATEOAS by vendor media type | `GET /api/v1/users/{id}`, `Accept: application/vnd.umapi.hateoas+json` | 200, same `Content-Type`. Body `{ value: <v1 detail>, links: [{href, rel, method}] }` with rels `self` GET, `update` PUT, `lock` POST `/lock`, `unlock` DELETE `/lock`, `assign-role` POST `/roles`. **Links are filtered neither by permission nor by state**: the demo account receives write links, and an Active user receives both `lock` and `unlock`. Affordances are never derived from them. | 2026-09-23 |

## Error bodies

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 34 | Three problem-details shapes exist | Rows 7, 10, 19, 27, 28 | **Application**: `type` on datatracker.ietf.org, `title`, `status`, `detail`, `instance`, `errorCode`, `traceId`, and `errors` on 422. **Framework** (401 from an invalid token, 403): `type` on tools.ietf.org, `title`, `status`, `instance`, `traceId`; no `detail`, no `errorCode`. **Rate limiter** (429): `type` rfc6585, `title`, `status`, `detail`, `instance`; no `errorCode`, no `traceId`. Only `status` and `title` are present in all three. | 2026-09-23 |
| 58 | A domain conflict, live | `POST /api/v1/users/{id}/roles` `{roleId}` as administrator, with the role the demo user already holds | 409, application shape: `title` "Conflict", `detail` "The user already holds this role.", `errorCode` `User.RoleAlreadyAssigned`, `instance`, `traceId`. Nothing changed. | 2026-09-25 |

## Health and infrastructure

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 35 | Cold start | First `GET /health/ready` after idle | 200 after 32.6 s. The same-day repository snapshot measured 33.6 s on `/health/live`. | 2026-09-23 |
| 36 | Warm liveness | `GET /health/live` straight after | 200 in 0.11 s | 2026-09-23 |
| 37 | Readiness with the database down | `GET /health/ready` | 503 after 56 s; liveness stays 200. Measured in the API's own verification session, not re-run here. | 2026-09-13 |
| 38 | Security headers | `GET /health/live`, `GET /api/v1/users` | `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, `Strict-Transport-Security: max-age=2592000` (no `includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Correlation-Id` | 2026-09-23 |
| 39 | Cloudflare sits in front of the instance | Any request | `Server: cloudflare`, `CF-RAY`, `cf-cache-status: DYNAMIC`, `x-render-origin-server: Kestrel` | 2026-09-23 |

## Read from the API source

`UserManagementAPI` working copy at `c182399`, read on 2026-09-23. Not measured;
see the note at the top.

| # | Fact | Where in the source | Confirmed live by |
|---|---|---|---|
| 43 | The search parameter is `searchTerm`: a case-insensitive substring match on email, first name and last name. It is **not** diacritic-insensitive — `ovic` does not match `Petrović`. | `UserQueryParameters`, `UserQueryExtensions.Search` | Row 56; diacritics after the M5 seed |
| 44 | ETags are strong at the origin: SHA-256 of the serialized body plus `X-Pagination`, base64url. `If-None-Match` is compared weakly, as RFC 9110 requires. | `ETagGenerator`, `ETagFilter` | Row 22 |
| 45 | No optimistic concurrency on users. The only concurrency token in the schema is PostgreSQL's `xmin` on `refresh_tokens`. `If-Match` is neither read nor allowed through CORS. | `RefreshTokenConfiguration`, model snapshot, `CorsExtensions` | Not measurable from outside: nothing reads `If-Match`. Row 25 shows the tag moves, row 57 that a write returns no tag |
| 46 | Concurrent refreshes: the loser of the `xmin` race gets 409 `Concurrency.Conflict` and nothing is revoked; a request that reads the already-rotated row is a replay, 401 `Auth.RefreshTokenReused`, and every active token of the account is revoked. The API's own test accepts either outcome. | `RefreshTokenCommandHandler`, `ConcurrencyExceptionHandler`, `ConcurrentRefreshTests` | Row 11: the 409 outcome, three times out of three |
| 47 | Sort whitelist: `email`, `firstName`, `lastName`, `status`, `createdAt`, case-insensitive, comma-separated clauses such as `lastName desc, email`. Default order `email asc`; the id is always the final key, so paging is stable. | `UserQueryExtensions.Sort` | Row 16 in part |
| 48 | Permissions per action: `users.read` (list, detail), `users.write` (register, update), `users.lock` (lock, unlock), `roles.read` (roles), `roles.manage` (assign, remove a role). | `UsersController`, `RolesController`, `PermissionCodes` | Row 27 for `users.write` |
| 49 | Status by error-code family: `Validation.*` 422; `Auth.*` 401; `*.NotFound` 404; `*NotUnique` and `*Already*` 409; everything else 400. So `User.AlreadyLocked`, `User.RoleAlreadyAssigned`, `User.EmailNotUnique` and `User.AlreadyDeactivated` are **409**, while `User.NotLocked`, `User.LastRoleCannotBeRemoved`, `User.RoleNotAssigned` and `User.Deactivated` (modifying a deactivated user) are **400**. | `ErrorMapping`, `User` | Row 58 for `User.RoleAlreadyAssigned` |
| 50 | There is **no last-administrator rule** and no guard against locking yourself: an administrator can lock the only administrator. The one related rule is that a user keeps at least one role (`User.LastRoleCannotBeRemoved`, 400). | `User.Lock`, `LockUserCommandHandler` | M5 step 3, locally |
| 51 | Locking does not revoke sessions. A locked user's refresh is refused (`Auth.AccountLocked`), so their session ends within fifteen minutes, when the access token expires. | `LockUserCommandHandler`, `RefreshTokenCommandHandler` | M5 step 3 |
| 52 | Rate-limit policies: `auth` 10/min keyed by **IP**, covering login, refresh **and** logout; `read` 100/min and `write` 30/min keyed by **user id**, IP when anonymous. `Retry-After` falls back to 60 s. Every visitor on the shared demo account shares one `read` budget. | `RateLimitingExtensions`, `RateLimitOptions` | Row 28 for `auth` |
| 53 | CORS: allowed request headers `Authorization`, `Content-Type`, `Accept`, `If-None-Match`; exposed response headers `X-Pagination`, `ETag`, `Retry-After`, `api-supported-versions`, `api-deprecated-versions`. `X-Correlation-Id` and `WWW-Authenticate` are **not** exposed, so a browser cannot read them. Credentials are already a configuration switch (`Cors:AllowCredentials`). | `CorsExtensions`, `CorsOptions` | M5 step 3 |
| 54 | Logout today takes the refresh token in the body, and answers 204. | `AuthController.Logout` | M5 changes it to the cookie |
| 55 | The update body is `{ email, firstName, lastName }`, all three required. | `UpdateUserRequest` | Row 57: the three-field body was accepted |

## The OpenAPI document

`/openapi/v1.json` as the deployed instance served it on 2026-09-25 - probe 10a,
run as the first step of PR 7. `src/lib/api/schema.d.ts` is generated from it.
Rows 60-63 are where the document and the instance part: the types follow the
document, the mock and the error handling follow these rows.

| # | Behaviour | Request | Response | Measured |
|---|---|---|---|---|
| 59 | The document is served in production | `GET` `/openapi/v1.json`, `/openapi/v2.json`, `/openapi`, `/swagger/v1/swagger.json`, `/scalar` | v1: 200, `application/json`, about 52 KB, OpenAPI **3.1.1**, 11 paths, 14 schemas. v2: 200. `/scalar`: 200, HTML. `/openapi` and `/swagger/...`: 404. `servers` is the instance's own origin and every path carries `/api/v1`, so a client's base URL is the origin alone. | 2026-09-25 |
| 60 | What the document describes differently from the instance | Read `/openapi/v1.json` | `ProblemDetails` has only `type`, `title`, `status`, `detail`, `instance`: no `errorCode`, `traceId` or `errors`, which the application shape carries (row 34). The HATEOAS media type is documented with the plain body, not `{ value, links }` (row 33). `status` on users is an open `string`, not the four values (row 18). | 2026-09-25 |
| 61 | Statuses the instance answers that the document does not list | Read `/openapi/v1.json` | 409 on refresh (row 11); 429 anywhere (row 28); 413 (row 29); 400 `User.Deactivated` on update, lock and role assignment, whose documented statuses stop at 404, 409 and 422 (row 49, read from the source). | 2026-09-25 |
| 62 | Authorisation is not described | Read `/openapi/v1.json` | No `securitySchemes`, no `security` on any operation. Neither the bearer token nor the `permission` claim (row 4) appears; which permission an operation needs comes from row 48. | 2026-09-25 |
| 63 | Operations and statuses the document lists that the console does not use | Read `/openapi/v1.json` | `HEAD` beside every `GET`, `OPTIONS /api/v1/users`, the root `GET /api` with links, `GET /api/v1/roles/{id}`. 406 on the user reads - the documented answer to an unsupported media type, not measured. | 2026-09-25 |
| 64 | Query parameters are named in PascalCase | Read `/openapi/v1.json` | `PageNumber`, `PageSize`, `SearchTerm`, `Status`, `OrderBy`; the first two typed `integer \| string`. Rows 13-19 and 56 were measured with camelCase names and bound, so binding ignores case; the typed client sends the document's spelling, which has not itself been sent live. | 2026-09-25 |

## Not API behaviour, but measured and relevant

| # | Observation | Consequence |
|---|---|---|
| 40 | The development machine's clock ran 1 min 50 s to 2 min 19 s ahead of the server's `Date` header | Expiry is never computed by comparing a server timestamp to the client clock. The session screen counts down `exp - iat` from the moment the response arrived. |
| 41 | Windows PowerShell 5.1 returns a `byte[]` as `Content` for the vendor media type, and throws on 304 | Probe artefacts only. Decode with `[Text.Encoding]::UTF8.GetString`; read 304 from the exception. A browser `fetch` has neither problem. |
| 42 | An access token expires mid-session during a long probe run | Every probe block starts with a fresh login. |

## Still to measure

| # | What | Probe | Blocks |
|---|---|---|---|
| - | Search and diacritics: `ovic` against `Petrović` | 5b again, after the M5 seed | Nothing; PR 12 is designed for no folding (row 43) |
| - | Query parameters in the document's PascalCase, live (row 64) | Any probe session | Nothing; binding ignores case |
| - | Rejection of an unsupported media type - documented as 406 (row 63) | 9, repeated | Nothing; the inspector renders whatever arrives |
| - | `User.LastRoleCannotBeRemoved`, and locking oneself | **Not probed against production** - row 50: nothing would refuse locking the only administrator. Exercised against the local API in M5 step 3. | PR 13's lock and remove-role dialogs |

Row 26 needs no probe any more: the source settles it (row 45). Probe 10a ran
as the first step of PR 7: rows 59-64.
