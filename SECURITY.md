# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| Earlier | No        |

This is a personal project built to a production standard. The supported
version is the latest release on `main`; fixes are not backported.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability.

Report it privately through GitHub: the repository's **Security** tab, then
**Report a vulnerability**. If that option is not offered, open an issue that
says only that you have something to report, with no details, and you will be
contacted. The same address is published at
`https://console.aleksadragnic.com/.well-known/security.txt` (RFC 9116).

A report is acknowledged within seven days. You will hear what is being done
about it and when a fix ships.

## Scope

In scope: this repository's code and what the deployed console serves - the
bundle, `public/_headers`, and how the console handles tokens, the refresh
cookie and what it shows in the inspector.

Out of scope:

- The API itself. It has its own policy:
  [UserManagementAPI/SECURITY.md](https://github.com/aleksa-dragnic/UserManagementAPI/blob/main/SECURITY.md).
- The published demo account. Its password is printed on the sign-in screen on
  purpose, and it can only read.
- Load or denial of service against the demo. The console is static files on
  Cloudflare Pages; the API behind it runs on free tiers and sleeps when idle.
- Findings that need a compromised machine, browser extension or Cloudflare
  account.

## What is already in place

- **No secret ships to the browser.** The bundle holds the API's public origin
  and nothing else; there is no API key, and nothing in `VITE_*` is secret.
- **Tokens.** The access token lives in memory only, never in storage, and a
  lint rule refuses `localStorage` and `sessionStorage` in `src/`. The refresh
  token never reaches JavaScript: it is an `HttpOnly`, `Secure`,
  `SameSite=Strict` cookie on `/api/v1/auth` only (ADR 0007).
- **Headers.** `public/_headers` sends a Content Security Policy that allows
  scripts and styles from the console itself and connections to the API alone,
  and requires Trusted Types; with HSTS, no framing, no referrer, no browser
  features and an isolated window (ADR 0015).
- **The inspector redacts.** Authorization headers, passwords and tokens are
  replaced before a request is recorded, and `Copy as curl` uses placeholders
  (ADR 0014).
- **Supply chain.** Versions are pinned exactly, a version must be a day old
  before pnpm installs it, `pnpm audit` fails the build on a high advisory,
  CodeQL analyses every pull request, and every GitHub Action is pinned to a
  commit.
