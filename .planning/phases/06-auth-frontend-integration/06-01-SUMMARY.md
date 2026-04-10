---
plan: 06-01
phase: 06-auth-frontend-integration
status: complete
started: 2026-04-11
completed: 2026-04-11
---

# Plan 06-01 Summary: SAML Auth Wiring + Auth Error Page

## What Was Built

Wired SAML authentication routes into the NestJS Express app, completed the tRPC context factory to extract JWT sessions from cookies, added conditional SAML env validation, created the auth error page with reason-based messages, built a reusable QueryError component, and updated the frontend middleware to use configurable API URL.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Wire SAML auth routes + tRPC context JWT extraction + env schema | ✓ Complete |
| 2 | Auth error page + QueryError component + middleware update | ✓ Complete |

## Key Files

### Created
- `apps/api/src/modules/auth/auth.routes.ts` — Express routes for /auth/saml/login, /auth/saml/callback, /auth/logout, /auth/dev-login
- `apps/web/src/app/auth/error/page.tsx` — Auth error page with reason-based messages (idp_unavailable, invalid_assertion, session_expired)
- `apps/web/src/components/common/query-error.tsx` — Reusable tRPC error display with retry button
- `.env.example` — Root env example with AUTH_JWT_SECRET and KEYCLOAK_SAML_* variables

### Modified
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — JWT extraction from cookie, verifySessionToken integration
- `apps/api/src/infrastructure/config/env.schema.ts` — AUTH_JWT_SECRET + KEYCLOAK_SAML_* with superRefine conditional validation
- `apps/api/src/main.ts` — mountAuthRoutes called after tRPC middleware
- `apps/web/src/middleware.ts` — Configurable API URL, public path prefixes for /auth

## Decisions Made

- Auth error page uses `useSearchParams()` with Suspense boundary (Next.js requirement for client-side search params)
- QueryError redirects to login on UNAUTHORIZED errors instead of showing error message
- Middleware adds /admin to protected paths and /auth to public paths

## Self-Check

All acceptance criteria verified:
- auth.routes.ts contains mountAuthRoutes, express.urlencoded, passport session:false, prisma.user.upsert, dev-login
- trpc.context.ts contains verifySessionToken, req.cookies
- env.schema.ts contains AUTH_JWT_SECRET, KEYCLOAK_SAML_CALLBACK_URL, superRefine
- main.ts contains mountAuthRoutes
- auth error page contains all reason codes and accessibility attributes
- query-error.tsx contains role="alert", Retry button, Connection/Server Error
- middleware.ts uses NEXT_PUBLIC_API_URL, no hardcoded localhost-only URL

## Issues

None.
