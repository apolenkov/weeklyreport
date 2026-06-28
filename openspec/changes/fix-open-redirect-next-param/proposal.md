## Why

The post-login redirect target (`next` on the web landing page, `next`/`redirect`
in the auth routes) is validated by a hand-rolled prefix check that a crafted
value can slip past, sending an authenticated victim off-origin to a phishing
host. `sanitizeNext` rejects only `startsWith('/')`, `'://'`, and `'//'`, but
`/\evil.com` passes all three and the browser resolves it to host `evil.com`
(WHATWG URL treats `\` as `/`). The same hole exists in the API SAML dev
short-circuit, and the dev-login `redirect` query param is concatenated onto the
frontend URL with no validation at all (`http://localhost:3000@evil.com` →
host `evil.com`). This is the P0-7 finding (BL-OPEN-REDIRECT) from the
2026-06-28 repo-excellence review.

## What Changes

- Replace the prefix-string `sanitizeNext` heuristic on the web landing page
  with URL-parser validation: a candidate is accepted only if
  `new URL(value, window.location.origin).origin` equals the current origin,
  with manual rejection of backslash and second-character `/`|`\` as
  defense-in-depth. Invalid input falls back to the role default.
- Harden the API SAML dev short-circuit guard (currently
  `startsWith('/') && !includes('://')`) the same way — the existing guard is
  itself vulnerable to the `/\` bypass, so it is a fix site, not a template.
- Validate the dev-login `redirect` query param (AUTH_DEV_MODE only) with the
  same hardened rule, and construct the final redirect URL with the same URL
  parser used to validate it, eliminating the parse-vs-concatenate differential
  that lets `@evil.com` through.
- Add regression tests covering the `/\evil.com`, `//evil.com`, `://`, and
  `@evil.com` bypass vectors plus the legitimate same-origin path case.

## Capabilities

### New Capabilities

- `safe-redirect-validation`: defines how any user-influenced post-login
  redirect target is validated against the application origin before a redirect
  is issued, across the web landing page and the auth routes.

### Modified Capabilities

<!-- None: no existing capability governs redirect-target validation. -->

## Impact

- Code: `apps/web/src/app/login-page.client.tsx` (`sanitizeNext`, the
  auto-redirect at `window.location.replace`, and the SSO `next` query builder);
  `apps/api/src/modules/auth/auth.routes.ts` (SAML dev short-circuit and the
  dev-login `redirect` handling).
- Tests: web unit tests for `sanitizeNext`; API route tests for the dev-login
  and SAML dev redirect guards.
- No dependency, schema, or public-API changes. No production behavior change
  for legitimate same-origin paths; only off-origin targets are now blocked.
