## Context

The app issues post-login redirects from three user-influenced sinks:

- Web `apps/web/src/app/login-page.client.tsx`: `sanitizeNext` (lines 100-106)
  feeds both `window.location.replace(safeNext)` (line 217) and the SSO link
  `?next=` (line 223).
- API `apps/api/src/modules/auth/auth.routes.ts`: the AUTH_DEV_MODE SAML
  short-circuit guard (line 347) and the dev-login `redirect` param
  (lines 527-529, concatenated as `${frontendUrl}${redirectPath}`).

`sanitizeNext` rejects only `startsWith('/')`, `'://'`, and `'//'`. The WHATWG
URL parser used by browsers treats `\` as `/` for http(s), so `/\evil.com`
passes every check and `window.location.replace("/\evil.com")` navigates to
host `evil.com`. The SAML guard `startsWith('/') && !includes('://')` has the
identical hole. The dev-login concat has no validation: `redirect=@evil.com`
yields `http://localhost:3000@evil.com`, whose host is `evil.com`.

The other auth redirects were swept and are out of scope: lines 385, 401, 438
redirect to static `frontendUrl` / `frontendUrl/auth/error` / `"/"` with no
user-controlled component.

## Goals / Non-Goals

**Goals:**

- Block every off-origin redirect from the three user-influenced sinks while
  preserving legitimate same-origin path redirects.
- Close the `/\` backslash bypass and the `@`-userinfo concatenation bypass.
- Cover each bypass vector with a regression test.

**Non-Goals:**

- No allow-list of specific internal paths; same-origin is the contract.
- No change to production SSO assertion handling or session issuance.
- No new dependency; the platform `URL` constructor is sufficient.

## Decisions

**Decision: validate with `new URL(value, origin)` + origin equality, not string
prefixes.**

Rationale: the prefix heuristic is a denylist and misses normalization quirks
(`\`, mixed slashes, tabs/newlines the parser strips). `new URL(value, origin)`
applies the same normalization the browser will, so
`new URL("/\evil.com", "http://localhost:3000").origin` is `http://evil.com`,
caught by `resolved.origin === expectedOrigin`. Verified empirically:
`/\evil.com`, `//evil.com`, `https://evil.com` all resolve off-origin; `/admin`
and `/lead/report` resolve same-origin.

The two sites read the base origin differently:

- API (Node) reads `new URL(env.FRONTEND_URL).origin`. No browser globals.
- Web validates against a fixed sentinel base, NOT `window.location.origin`.

**Decision: the web helper is SSR-safe — it never reads `window` during render.**

Rationale: `sanitizeNext` runs inside `LoginPageBody`, a client component whose
body executes server-side during dynamic SSR, where `window` is `undefined`.
Reading `window.location.origin` in render would throw a ReferenceError on the
server. The Suspense boundary around `useSearchParams` may defer the body during
static prerender, but the validation must not depend on that timing. The helper
therefore parses the candidate against a fixed in-code sentinel base origin
(e.g. `new URL(value, "https://app.invalid")`), accepts it only when the
resolved `origin` still equals the sentinel (proving it is a true relative
path), and returns only `pathname + search + hash` — never an absolute href.
The result is a relative path the browser later resolves against its real
origin, so the validated value is correct in both runtimes without any
browser-global access at render time. The defense-in-depth string checks
(reject leading `//`, `/\`, second char `/`|`\`) are kept on top.

Alternative considered: extend the denylist with a backslash check only. Rejected
— it patches one vector and leaves the class open (control chars, future quirks).
The manual checks (reject leading `//`, `/\`, second char `/`|`\`) are kept as
cheap defense-in-depth layered on top of the parser, not as the primary gate.

**Decision: in dev-login, construct the redirect with the same parser that
validates it.**

Rationale: the live bug is a parse-vs-sink differential. `new URL("@evil.com",
base)` validates as same-origin (a relative path), but the sink concatenates
`base + "@evil.com"` which re-parses to host `evil.com`. Building the final URL
as `new URL(validatedPath, frontendUrl)` and redirecting to that resolved href
(only when its origin matches) removes the second, divergent parse. Validation
and construction must share one parser pass.

**Decision: a single shared validation helper, reused at all three sites.**

Rationale: three copies drifted into three different bugs. One helper (one in
web, one in API — they read origin from different places) keeps the rule in one
place. Do NOT "reuse the existing SAML guard" verbatim: that guard is itself a
fix site.

## Risks / Trade-offs

- [A legitimate deep-link with an unusual but same-origin path is rejected] →
  origin equality accepts any same-origin path; only cross-origin and malformed
  values fall back, so legitimate in-app paths are unaffected.
- [`URL` parsing differences between Node and the browser] → both implement
  WHATWG URL; the same-origin invariant holds in both. Tests assert behavior in
  each runtime rather than assuming parity.
- [Fallback masks a genuine misconfigured internal link] → acceptable: a safe
  default landing is preferable to an open redirect; the dropped value is
  recoverable from logs if needed.

## Migration Plan

No data or schema migration. Ship the web and API guard changes together so the
SAML short-circuit and dev-login agree on the rule. Rollback is a straight revert
of the two source files; no persisted state is touched.

## Open Questions

- None blocking. If a future non-dev redirect sink is added, it must route
  through the same helper — noted for reviewers, not required by this change.
