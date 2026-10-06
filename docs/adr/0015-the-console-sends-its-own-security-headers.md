# 0015 - The console sends its own security headers, from a file in the repository

- **Status:** Accepted
- **Date:** 2026-10-06
- **PR:** #26

## Context

The console is static files on Cloudflare Pages. Pages serves them with its
own defaults and nothing else: `Access-Control-Allow-Origin: *`,
`Cache-Control`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Content-Type-Options: nosniff`, and Cloudflare's reporting headers - no
`Content-Security-Policy`, no `Strict-Transport-Security`, nothing against
framing (`docs/OBSERVED-BEHAVIOUR.md` row 87). The API sends all of those on
every response (row 38).

The access token lives in the page's memory (ADR 0007), so any script that
runs in the console's origin can read it and act with it. Which scripts run
there is therefore the console's main security boundary. It has already been
crossed once without anyone writing code: Cloudflare's edge injected a Web
Analytics script into the HTML, which was in no repository and no `dist`
(row 88). It is switched off in the dashboard, and nothing in this repository
would notice it, or anything like it, coming back.

Pages applies a `_headers` file found in the build output, and Vite copies
`public/` into `dist` unchanged.

## Decision

`public/_headers` holds one rule, `/*`, so every response - the HTML of every
route, which Pages answers with `index.html`, and every asset - carries:

- `Content-Security-Policy` that starts from `default-src 'none'` and allows
  only what the production bundle uses: `script-src 'self'` and
  `style-src 'self'` (one module script and one stylesheet, nothing inline;
  React's `style` prop goes through the CSSOM, which the policy does not
  govern); `font-src 'self' data:` (Vite inlines the one font subset under its
  4 kB limit as a `data:` URL); `img-src 'self'` (the browser's own favicon
  request); `connect-src https://api.aleksadragnic.com`, the API and nothing
  else; `worker-src 'none'`, because `mockServiceWorker.js` ships in `dist`
  and must never be registered there; `base-uri`, `form-action` and
  `frame-ancestors` all `'none'`, as on the API.
- `Strict-Transport-Security: max-age=2592000`, the API's value.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and
  `Referrer-Policy: no-referrer`, as on the API.

A new origin the console needs - a host for images, a script, an endpoint -
is added to this file in the same pull request that starts using it.

## Alternatives considered

### Headers set in Cloudflare's dashboard

A transform rule on the zone would send the same headers. Rejected: the policy
would live outside the repository, unseen by review and by the test below -
the same reason the deployed origin is not a variable in Pages (ADR 0006).

### A `<meta http-equiv="Content-Security-Policy">` in `index.html`

Rejected: a policy delivered that way cannot set `frame-ancestors`, cannot
carry the other headers, and applies to the development server too, where
Vite's own inline scripts would be refused.

### `style-src 'unsafe-inline'`

The usual allowance for a React application. Rejected as unnecessary: nothing
in the bundle writes a `style` attribute or a `<style>` element, so allowing
them would only widen what an injected stylesheet could do.

### `font-src 'self'`, with Vite's inlining turned off

Rejected: it changes the build to serve a policy, for one font subset. A
`data:` font can carry no script.

## Consequences

Pages applies the file to the production deploy and to every preview deploy.
`vite dev` and `vite preview` do not read it, so the mock, the unit suite and
the end-to-end suite are unaffected - and none of them can see what Pages
serves. The served headers are checked by hand after a deploy, with
`curl.exe` and a signed-in session in a browser whose console shows no
policy violation.

Anything injected into the page from outside the bundle is refused and shows
as a policy violation in the browser's console, which is how a returning edge
script would now be noticed.

The deployed origin is written a fourth time, in `connect-src`. ADR 0006,
which names three places, is left as written; build plan section 14 records
the fourth.

Enforced by `src/lib/api/security-headers.test.ts`: `connect-src` is exactly
`DEPLOYED_API_ORIGIN`, so moving the origin without this file fails the unit
suite, and `default-src`, `script-src`, `style-src` and `frame-ancestors` stay
as decided. What Pages actually sends is not enforced by anything automated.
