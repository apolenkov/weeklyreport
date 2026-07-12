## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`POST /auth/logout` has no CSRF/origin check, so a cross-site auto-submit
form can force a victim's browser to log them out (session-DoS: no data
exposure, no takeover). `POST /api/revalidate-org` checks only that a
session exists — any authenticated role, not just admin, can trigger a
full ISR cache purge, which is broader than its actual caller (the admin
settings page). The nav-bar logout button ignores the `fetch` result and
unconditionally redirects home, so a failed server-side logout still shows
the user as logged out client-side while the session cookie remains valid.
Separately, logout clears the session cookie but never revokes the
underlying JWT — an exfiltrated token stays usable until its 1h expiry —
which is an accepted stateless-session tradeoff that is not yet written
down anywhere.

This change is scoped exactly to the four items above. It explicitly does
**not** add jti-based revocation infrastructure or any head-lifecycle
authz guard — both were considered and declined by the repo owner.

## What Changes

- `apps/api/src/modules/auth/auth.routes.ts`: `createLogoutHandler` rejects
  a `POST /auth/logout` whose `Origin` header is present and does not match
  `frontendUrl`, responding `403 Forbidden` instead of clearing the cookie
  and redirecting. Requests with no `Origin` header (same-origin form posts,
  server-to-server) pass through unchanged — the same rule already applied
  to `api/revalidate-org`.
- `apps/web/src/app/api/revalidate-org/route.ts`: after the existing
  session check, reject any session whose role is not `admin` (via the
  shared `isAdmin` predicate) with `403 Forbidden`, before the CSRF check
  and the ISR purge.
- `apps/web/src/shared/ui/navigation/nav-bar.tsx`: the logout button's
  `fetch("/auth/logout")` only navigates to `/` when `response.ok` is
  true. A non-OK response or a network failure leaves the user on the
  current page instead of redirecting as if logout had succeeded.
- `openspec/specs/jwt-session-integrity/spec.md`: add a requirement
  documenting that logout is stateless — it clears the client cookie but
  does not revoke the signed JWT, so a copied token stays valid until its
  1h expiry. This is an accepted tradeoff, not a defect to fix here.

## Capabilities

### New Capabilities

- `session-endpoint-hardening`: the three concrete request-level checks
  (logout CSRF/origin, revalidate-org admin gate, client-side logout
  response check) that close this bounded threat model.

### Modified Capabilities

- `jwt-session-integrity`: adds the documented stateless-logout window as
  an accepted requirement, alongside the existing algorithm-pinning and
  secret-strength requirements.

## Impact

- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/web/src/app/api/revalidate-org/route.ts`
- `apps/web/src/shared/ui/navigation/nav-bar.tsx`

Non-goals: no jti/session-revocation infrastructure (stateless-logout
window is documented, not closed); no head-lifecycle authz guard (declined
by the repo owner); no change to the SAML/dev-login session-building path.
