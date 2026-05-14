# Phase 24: Auth Guards & Session - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous flow

<domain>
## Phase Boundary

Unauthenticated users redirected to /login via Next.js proxy.ts. Session context (user name, role, avatar) available in (app)/ layouts. 401 responses trigger redirect with return URL preserved. AUTH_STUB=true bypass remains functional.

**Key deliverables:**

1. Next.js 16 proxy.ts (replaces middleware.ts) — checks session cookie
2. Redirect to /login if no session, preserve return URL via ?next=
3. AUTH_STUB=true bypass at proxy level (no cookie required when stub)
4. Session context provider in (app)/layout.tsx — exposes user info via React context
5. tRPC client interceptor — on 401, redirect to /login with current URL preserved

</domain>

<decisions>
## Implementation Decisions

### Proxy (Next.js 16 replacement for middleware.ts)

- File: apps/web/proxy.ts
- Match: all routes except /, /login, /auth/\*, /trpc, /api, /\_next, /favicon.ico
- Logic: read session cookie → if missing AND AUTH_STUB!=='true' → redirect /login?next={originalPath}
- AUTH_STUB=true → pass through (dev/test mode)

### Session Context

- New: apps/web/src/lib/session-provider.tsx — client component reads session from cookie or tRPC `auth.me` query
- Wrap (app)/layout.tsx → consumers use useSession() hook
- Expose: { user: { id, name, email, role }, isLoading, isAuthenticated }
- AUTH_STUB mode returns DEV_SESSION user

### 401 Interceptor

- Add to apps/web/src/lib/trpc.ts — link middleware on httpBatchLink
- Detect 401 → window.location = `/login?next=${encodeURIComponent(currentPath)}`
- Optional: save form draft to localStorage before redirect (advanced — defer)

### Login Page

- /login already exists from Phase 17 (mockup s8). Update to:
  - Read ?next= query param
  - On successful auth → redirect to next URL (or /head/dashboard if not provided)

### Claude's Discretion

- Cookie name (default "customreport.sid")
- Session refresh strategy (re-query auth.me every 5 min)

</decisions>

<code_context>

## Existing Code Insights

### Already Built

- apps/web/src/app/page.tsx — login page (s8 design)
- apps/api SAML routes exist (apps/api/src/modules/auth/) but not used in AUTH_STUB mode
- DEV_SESSION in apps/api/src/infrastructure/trpc/trpc.context.ts with hardcoded UUIDs
- AUTH_STUB env var documented in apps/web/.env

### Established Patterns

- Next.js 16 — proxy.ts replaces middleware.ts (per project tech stack docs)
- tRPC link middleware pattern for cross-cutting concerns
- Cookie-based session (httpOnly, sameSite=lax)

### Integration Points

- Create: apps/web/proxy.ts (root-level, NOT in src/)
- Create: apps/web/src/lib/session-provider.tsx
- Modify: apps/web/src/app/(app)/layout.tsx (wrap children in SessionProvider)
- Modify: apps/web/src/lib/trpc.ts (add 401 interceptor link)
- Modify: apps/web/src/app/page.tsx (handle ?next= param)
- Optional: apps/api auth.me endpoint if missing

</code_context>

<specifics>
## Specific Ideas

- Use Next.js 16 NextResponse.redirect for proxy.ts
- 401 interceptor should NOT redirect on /login or /auth/\* pages (avoid loops)
- AUTH_STUB acts at BOTH proxy level (frontend) and trpc.context level (backend already does)

</specifics>

<deferred>
## Deferred Ideas

- Full SAML SSO flow → keep AUTH_STUB for v5.0
- Session refresh tokens → v6.0+
- Multi-tenancy → v6.0+
- Role-based UI (currently admin-only access via stub) → Role separation milestone (v6.0+)

</deferred>
