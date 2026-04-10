# Phase 6: Auth & Frontend Integration - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users authenticate via Keycloak SAML, frontend calls real NestJS tRPC API instead of localStorage; the full user journey works end-to-end in a browser. Dev bypass mode provides hardcoded session for local development without Keycloak.

Requirements: AUTHZ-01, AUTHZ-02, AUTHZ-03, AUTHZ-04, AUTHZ-05, AUTHZ-06, FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, FE-07, FE-08, FE-09, FE-10, QA-02, QA-03

</domain>

<decisions>
## Implementation Decisions

### SAML Auth Flow
- **D-01:** JWT session cookie TTL = 1 hour (already configured in auth.controller.ts `ONE_HOUR_IN_SECONDS`)
- **D-02:** No refresh token — when JWT expires, redirect to Keycloak (SSO session still alive → instant re-login)
- **D-03:** Auth errors (Keycloak down, invalid assertion) → dedicated `/auth/error` page with human-readable message and "Try again" button
- **D-04:** Use reference-app (forge.example.org/example/platform/reference-app) as reference implementation for SAML/Keycloak config — take base patterns and configurations from there

### tRPC Client
- **D-05:** `@trpc/react-query` (TanStack Query) as the tRPC client for Next.js — hooks pattern: `trpc.reports.getActive.useQuery()`, `trpc.reports.saveDraft.useMutation()`
- **D-06:** tRPC client + Provider at `apps/web/src/lib/trpc.ts`, TRPCProvider wraps app in `layout.tsx`
- **D-07:** `httpBatchLink` pointing to `http://localhost:3001/trpc` (configurable via env), cookie forwarding for auth

### localStorage Migration
- **D-08:** Big-bang replacement — all localStorage calls replaced with tRPC hooks in one phase. Delete `section-storage.ts`, `report-runtime.ts`, `admin-runtime.ts`, `demo-section.ts`, `demo-data` files, and `use-browser-state.ts`
- **D-09:** `dev-session.ts` deleted — dev bypass is now server-side only (trpc.context.ts `AUTH_DEV_MODE=true` returns hardcoded session via cookie)
- **D-10:** Remove all `STORAGE_KEY` constants and `localStorage.getItem/setItem` calls from frontend

### Testing Strategy
- **D-11:** Unit/component tests mock tRPC via MSW (Mock Service Worker) — intercept HTTP at network level
- **D-12:** E2E tests (Playwright) run against real NestJS API + PostgreSQL — maximum fidelity
- **D-13:** Fix all 24 previously-failing frontend tests after tRPC migration

### Claude's Discretion
- tRPC client configuration details (batch size, retry policy, stale time)
- Component refactoring approach during localStorage→tRPC migration
- MSW handler structure and test data fixtures
- Error boundary/loading state patterns for tRPC queries

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Reference Implementation
- reference-app (forge.example.org/example/platform/reference-app) — OIDC+JWKS Keycloak auth, take base SAML config patterns from there

### Existing Auth Code (already in codebase)
- `apps/api/src/modules/auth/auth.controller.ts` — JWT signer, session cookie creation
- `apps/api/src/modules/auth/saml.strategy.ts` — SAML strategy with Keycloak config
- `apps/api/src/modules/auth/jwt.strategy.ts` — JWT verification strategy
- `apps/api/src/modules/auth/auth.module.ts` — NestJS auth module
- `apps/api/src/modules/auth/auth.e2e.spec.ts` — Auth E2E tests
- `apps/web/src/middleware.ts` — Next.js middleware checking cookie, redirect to login
- `apps/web/src/server/auth/session.ts` — Cookie extraction, session parsing
- `apps/web/src/lib/dev-session.ts` — Dev sessions (TO BE DELETED)

### tRPC Backend (Phase 5 output)
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — AppRouter with 7 namespaces
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — Context factory with dev bypass
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — protectedProcedure, headProcedure
- `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts` — Domain error mapping

### Files to Migrate (localStorage → tRPC)
- `apps/web/src/components/report-section/section-storage.ts` — Lead section localStorage
- `apps/web/src/components/report/report-runtime.ts` — Report assembly localStorage
- `apps/web/src/components/admin/admin-runtime.ts` — Admin snapshot localStorage
- `apps/web/src/lib/use-browser-state.ts` — Browser state hook

### Shared Types
- `packages/shared/src/schemas/auth.ts` — UserSession type
- `packages/shared/src/trpc/router.ts` — Shared router contract (4 procedures)
- `packages/shared/src/schemas/report.ts` — All domain Zod schemas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `auth.controller.ts` — JWT signer/verifier + session cookie, fully working
- `saml.strategy.ts` — SAML strategy with Keycloak config, needs wiring to NestJS route
- `middleware.ts` — Next.js auth middleware, checks cookie → redirect to /auth/saml/login
- `session.ts` (web) — extractSessionToken, parseSessionPayload utilities
- tRPC infrastructure from Phase 5 — full AppRouter, context, middleware, error mapper

### Established Patterns
- Repository interface pattern with constructor injection (NestJS DI)
- tRPC auth as middleware (not NestJS guards) — decided in Phase 5
- Dev bypass via `AUTH_DEV_MODE=true` env var (backend-side)
- Zod parse on all inputs/outputs

### Integration Points
- `apps/api/src/main.ts` — needs auth routes mounted alongside tRPC
- `apps/web/src/app/layout.tsx` — needs TRPCProvider wrapper
- All component files importing from `*-storage.ts` and `*-runtime.ts` — need rewrite to tRPC hooks
- 11 files with localStorage references to migrate

</code_context>

<specifics>
## Specific Ideas

- Auth implementation based on reference-app reference — "базовые вещи и конфигурации взять оттуда"
- Big-bang localStorage replacement — no incremental migration, no feature flags

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-auth-frontend-integration*
*Context gathered: 2026-04-10*
