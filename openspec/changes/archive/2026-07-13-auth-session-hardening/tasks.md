## 1. Logout CSRF/origin check

- [ ] 1.1 `apps/api/src/modules/auth/auth.routes.ts`: widen
      `createLogoutHandler`'s deps type from `Pick<AuthRouteDeps,
"auditLogger" | "env">` to also include `"frontendUrl"`
- [ ] 1.2 In the handler, before emitting the audit log or clearing the
      cookie: read `request.headers.origin`; if present and it does not
      equal `deps.frontendUrl`, respond `res.status(403).json({ error:
"Forbidden" })` and return — do not clear the cookie, do not audit-log
      a logout, do not redirect
- [ ] 1.3 Leave the no-`Origin`-header path (same-origin form POST,
      server-to-server) unchanged, matching `revalidate-org`'s existing
      CSRF rule

## 2. Admin gate on revalidate-org

- [ ] 2.1 `apps/web/src/app/api/revalidate-org/route.ts`: import `isAdmin`
      from `apps/web/src/lib/role-predicates.ts`
- [ ] 2.2 After the existing `if (!session)` 401 check and before the
      Origin/CSRF check, add: `if (!isAdmin(session.role)) return
NextResponse.json({ error: "Forbidden" }, { status: 403 });`
- [ ] 2.3 Update the handler's doc comment to say "Admin-only" instead of
      "only authenticated users"

## 3. Nav-bar logout response check

- [ ] 3.1 `apps/web/src/shared/ui/navigation/nav-bar.tsx`: replace the
      `.finally(() => window.location.href = "/")` on the logout `fetch`
      with `.then((response) => { if (response.ok) window.location.href =
"/"; })` — a non-OK response or a network rejection leaves the user
      on the current page instead of redirecting as if logout succeeded
- [ ] 3.2 Update the adjacent comment: it no longer describes an
      unconditional fire-and-forget redirect

## 4. Document the stateless-logout window

- [ ] 4.1 `openspec/specs/jwt-session-integrity/spec.md`: ADD a
      requirement stating that logout clears only the client-side session
      cookie and does not revoke the signed JWT itself, so a copied token
      remains valid until its 1h expiry; per-session revocation would
      require jti tracking, which is out of scope for this change

## 5. Spec delta

- [ ] 5.1 `session-endpoint-hardening` (new capability): ADD the three
      requirements covering logout CSRF, revalidate-org's admin gate, and
      the nav-bar's response-checked redirect
- [ ] 5.2 `jwt-session-integrity`: ADD the stateless-logout-window
      requirement (task 4.1)

## 6. Gates and verification

- [ ] 6.1 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.2 Live-check: `curl -i -X POST http://localhost:3002/auth/logout -H "Origin: https://evil.example"` returns 403 and does not set a cleared `Set-Cookie` header
- [ ] 6.3 Live-check: logging in as `lead` and POSTing to `/api/revalidate-org` returns 403; the same call as `admin` returns `{ revalidated: true }`
- [ ] 6.4 Live-check in the browser: throttle/stub the network so `/auth/logout` fails, confirm the nav bar does not redirect to `/` and the session cookie is still present
- [ ] 6.5 `openspec validate auth-session-hardening --strict`
- [ ] 6.6 Adversarial review of the diff before archiving
