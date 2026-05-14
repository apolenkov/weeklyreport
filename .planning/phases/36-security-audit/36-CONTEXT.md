# Phase 36: Security & Audit — Context

**Gathered:** 2026-05-05 (post-hoc; 36-01 + 36-03 + 36-04 shipped; 36-02 audit-trail extension residual)
**Status:** Ready for planning (residual: 36-02 audit-trail extension to all mutations)
**Mode:** Post-hoc scaffold — full milestone detail in `.planning/milestones/v8.0-ROADMAP.md`

<domain>
## Phase Boundary

Make the production attack surface defensible:

1. Rate-limit the auth + tRPC planes (express-rate-limit, three tiers).
2. Extend audit-logger from auth-events-only to every mutation across the system (admin._+ leadForm._ + period._+ reports._ + reminders.\*).
3. Add production fences in env.schema (boot abort on misconfiguration).
4. Multi-origin CORS via FRONTEND_URLS CSV; wildcards rejected in production.

In scope: express-rate-limit middleware factory, env.schema superRefine production checks, FRONTEND_URLS CSV parsing in main.ts CORS config, tRPC middleware that captures every mutation with {actor, action, target, diff, timestamp} via existing audit-logger envelope.

Out of scope: CSRF middleware (assessed not needed — tRPC over fetch with same-origin cookies); audit dashboard UI (v8.1+); SOC2 / SOX-ready event filtering (org-side compliance scope).
</domain>

<decisions>
## Implementation Decisions

- **Rate-limit at express layer, not NestJS Throttler:** the app is express-mounted (tRPC + auth routes are raw express handlers). NestJS Throttler is for `@UseGuards` on controller methods — wrong fit here. express-rate-limit applies as middleware before the relevant route mounts.
- **Three-tier rate strategy:** /auth at 5/min/IP (brute-force defense), /trpc at 200/min/IP (legitimate users on first lead-form load do ~10 req in 30s), NODE_ENV=test bumps both to 1000/min for E2E.
- **Audit-trail middleware (36-02 residual):** tRPC middleware capturing every mutation, not per-procedure manual audit calls. Reduces drift — adding a new mutation can't accidentally skip the audit log.
- **No CSRF token middleware:** tRPC POST requests carry session cookie (SameSite=Lax) and include CORS-validated origin. CSRF token would be defense-in-depth but not currently load-bearing. Revisit if cross-origin write surface emerges.

</decisions>

<code_context>

## Existing Code Insights

- `apps/api/src/lib/audit-logger.ts` exists from Phase 29-01: type-safe envelope, PII-redacted, drives via AppLogger. Currently called by auth.routes.ts only (login-success, login-fail, logout, role-denied). 36-02 extends this surface to every mutation via tRPC middleware.
- `apps/api/src/main.ts` mounts middlewares in order: helmet → cookie-parser → CLS → CORS → http access log → /trpc. Phase 36 inserts: rate-limiter before /trpc, rate-limiter before mountAuthRoutes.
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` already has the structured-logging middleware. 36-02 will add an audit-trail middleware alongside.

</code_context>

<specifics>
## Specific Ideas

- 36-02: middleware factory takes `auditLogger` from deps; extracts `procedure.type === 'mutation'`, captures `input` (PII-redacted via existing redactor), captures `result` for delta diff if cheap (most are `{success: true}`).
- 36-02 storage: phase v8.0 keeps audit lines in structured JSON log file (RUNBOOK doc-trail). v8.1+ candidate: persisted `AuditLog` Prisma model + admin viewer.

</specifics>

<deferred>
## Deferred Ideas

- Persisted audit table + admin viewer — v8.1+.
- IP-allowlist per role (head-only originating from VPN range) — discussed in v7.0 ADRs, not in v8.0.
- WAF integration — covered by 38-02 caddy reverse-proxy if/when needed.

</deferred>
