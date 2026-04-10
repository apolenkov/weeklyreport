# Project Research Summary

**Project:** CustomReport
**Domain:** Internal enterprise tool -- weekly status report automation (NestJS + Next.js monorepo)
**Researched:** 2026-04-10
**Milestone:** v2.0 Infrastructure Integration
**Confidence:** HIGH

## Executive Summary

CustomReport is a working domain-logic prototype that needs infrastructure wiring to become a production application. The v1 codebase already delivers 8 domain services with repository interfaces, shared Zod schemas, tRPC router contracts, SAML/JWT auth primitives, a complete frontend UI on localStorage, and 51 unit tests. This is NOT a greenfield build. The v2.0 milestone is an infrastructure integration task: implement Prisma repository interfaces, wire tRPC transport, connect SAML auth, add BullMQ job processing, and containerize with Docker Compose.

The recommended approach follows the existing architectural seams. Every service accepts a `Repository` interface via constructor injection -- Prisma implementations plug directly into these seams. The tRPC router contract already exists in `packages/shared` -- mounting it via tRPC's official Express adapter on NestJS is the standard pattern. Auth factory functions (`createSamlStrategy`, `createJwtSigner`, `createRoleGuard`) are pure and tested -- they need NestJS `useFactory` wrappers, not rewrites. The critical path is: Prisma schema migration -> repository implementations -> NestJS bootstrap + tRPC -> frontend tRPC wiring. Docker Compose wraps everything last.

The highest risks are infrastructure integration mistakes, not domain logic gaps. Five critical pitfalls dominate: (1) PgBouncer prepared statement conflicts with Prisma, (2) Prisma migrations running through PgBouncer instead of direct connection, (3) NestJS guards being silently bypassed on tRPC routes (security), (4) Redis eviction policy destroying BullMQ jobs, and (5) SAML callback cookie domain mismatches between API and frontend origins. All five are preventable with correct configuration documented in PITFALLS.md, but each one causes production failures that are hard to diagnose retroactively.

## Key Findings

### Recommended Stack

The base stack (Next.js 15.5, NestJS 11, Prisma 7, Zod 4, tRPC 11, shadcn/ui, Vitest, Playwright, Turborepo, pnpm) is validated and locked from v1. The v2.0 milestone adds only infrastructure integration packages -- no new frameworks or paradigm shifts. All new dependencies are official NestJS packages or battle-tested community libraries.

**New dependencies for apps/api (production):**
- `@nestjs/platform-express@^11.1.0`: Bootstrap NestJS HTTP server on Express
- `@nestjs/config@^4.0.0`: Centralized, Zod-validated environment configuration
- `@nestjs/terminus@^11.1.0`: Health check endpoints (/health/live, /health/ready)
- `@nestjs/bullmq@^11.0.0` + `bullmq@^5.0.0`: Job queue for PDF export and email reminders
- `helmet@^8.0.0`: Security headers (CORS, CSP, HSTS)
- `@willsoto/nestjs-prometheus@^6.0.0` + `prom-client@^15.0.0`: Prometheus metrics endpoint
- `@bull-board/api@^6.20.0` + `@bull-board/nestjs@^6.20.0` + `@bull-board/express@^6.20.0`: Queue monitoring UI
- `@prisma/client@^7.0.0` (prod) + `prisma@^7.0.0` (dev): Database ORM and CLI

**New dependency for apps/web (production):**
- `@trpc/client@^11.16.0`: Frontend tRPC client for API calls

**Explicitly rejected (with rationale):**
- `nestjs-trpc` / `trpc-nestjs-adapter` -- adds decorator-based schema generation conflicting with existing shared router contract
- `@trpc/react-query` -- unnecessary weight for 6 users; vanilla `@trpc/client` with Next.js is simpler
- `@nestjs/jwt` -- codebase already has `jsonwebtoken` with clean wrappers
- `nest-keycloak-connect` -- OpenID Connect focused, not SAML
- `NextAuth.js` -- weak SAML support
- `@nestjs/schedule` -- BullMQ repeatable jobs handle scheduling; one queue system, not two
- `@nestjs/opentelemetry` -- overkill for single-service, 6-user app
- Kubernetes manifests -- Docker Compose sufficient at this scale

### Expected Features

**Table Stakes (7 features -- 80% of effort):**
- **T1** NestJS HTTP bootstrap + tRPC adapter -- without this, no API exists
- **T2** Prisma repository implementations (8 services) -- without this, no persistence
- **T3** Prisma migrations + seed data -- without this, no database tables
- **T4** Docker Compose orchestration -- without this, no deployment path
- **T5** Frontend tRPC client wiring -- without this, UI is a localStorage demo
- **T6** SAML SSO authentication flow -- without this, users cannot log in
- **T7** BullMQ job queue for PDF + email -- without this, async jobs stay queued forever

**Differentiators (8 features -- quick wins after foundation):**
- D1 Health check endpoints (`@nestjs/terminus`)
- D2 Structured error handling (tRPC error codes mapped from domain errors)
- D3 Request logging + correlation IDs
- D4 Graceful shutdown (drain connections on SIGTERM)
- D5 Rate limiting (`@nestjs/throttler`)
- D6 CORS configuration
- D7 Environment configuration module (Zod-validated env vars, fail-fast)
- D8 PgBouncer connection pooling

**Explicitly deferred (anti-features):**
- Kubernetes deployment -- Docker Compose sufficient for 6+1 users
- S3/MinIO for PDF storage -- filesystem volume sufficient for <1000 PDFs
- CI/CD pipeline -- orthogonal, add after infrastructure milestone
- Prometheus/Grafana stack -- health endpoints + structured logs sufficient
- Redis Sentinel/Cluster -- single instance handles the load
- Multi-environment config -- single environment sufficient initially
- Database backup automation -- manual pg_dump documented in README
- API versioning -- tRPC + Zod handle schema evolution

### Architecture Approach

The architecture follows a clean layered pattern: NestJS modules wire domain services to Prisma repository implementations via DI. tRPC runs as Express middleware mounted on NestJS (not through NestJS controller layer). SAML auth uses Express routes for the login/callback flow, while JWT validation happens in tRPC context factory middleware. BullMQ processors run in-process with the API (no separate worker service at this scale). Docker Compose orchestrates PostgreSQL, Redis, API, and Web containers with health-check-based startup ordering.

**Major components:**
1. **PrismaModule** (global) -- singleton PrismaService extending PrismaClient, handles connect/disconnect lifecycle
2. **TrpcModule** -- mounts unified AppRouter as Express middleware at `/trpc`, context factory extracts JWT session
3. **AuthNestModule** -- wraps existing factory functions in NestJS providers, 2 Express routes for SAML flow
4. **QueuesModule** -- BullMQ registration (pdf-export, email-reminders queues), in-process processors
5. **HealthModule** -- Terminus-based health checks (DB + Redis + memory)
6. **8x Domain modules** -- each wires service + Prisma repository implementation
7. **Frontend tRPC client** -- `createTRPCReact<AppRouter>()` replacing all localStorage access
8. **Docker infrastructure** -- multi-stage Dockerfiles using `turbo prune --docker`, Compose orchestration

**Key architectural decisions:**
- Auth/role checks implemented as tRPC middleware, NOT NestJS guards (guards are bypassed on tRPC routes)
- Validate exclusively with Zod via tRPC input schemas -- no class-validator duplication
- Keep client components for interactive pages (lead form, admin); consider RSC only for read-heavy pages (archive)
- Single API process with in-process BullMQ workers; extract to separate service only when PDF memory impacts API latency

### Critical Pitfalls

All 4 researchers converged on 5 critical and 10 moderate/minor pitfalls. The critical ones must be addressed in configuration during their respective phases:

1. **NestJS guards silently bypassed on tRPC routes (#3)** -- tRPC runs below NestJS decorator pipeline. All auth must be tRPC middleware (`isAuthenticated`, `hasRole`), never `@UseGuards`. Detection: call any tRPC endpoint without auth header; if it returns data, security is broken.

2. **PgBouncer prepared statement conflict with Prisma (#1)** -- Prisma generates prepared statements; PgBouncer < 1.21 cannot track them across transactions. Use PgBouncer 1.22+ with `max_prepared_statements = 256`. Do NOT add `?pgbouncer=true` for PgBouncer 1.21+.

3. **Prisma migrations through PgBouncer corrupt schema (#2)** -- DDL needs persistent connections. Always define `directUrl` in schema.prisma pointing to PostgreSQL directly. Migration commands auto-use `directUrl` when defined.

4. **Redis eviction destroys BullMQ jobs (#4)** -- default `allkeys-lru` evicts BullMQ metadata. Set `maxmemory-policy noeviction` on queue Redis. Recommended: separate Redis instances for cache vs queue in production.

5. **SAML callback cookie domain mismatch (#9)** -- API on different origin than frontend means cookie is not readable by Next.js. Solution: same-domain reverse proxy or token redirect flow (API callback -> redirect to frontend with JWT param -> frontend sets cookie on its domain).

## Implications for Roadmap

All 4 research files independently converge on the same 7-phase build order, confirming strong consensus. The phasing follows dependency edges: database first, then API bootstrap, then transport, then auth, then frontend, then async jobs, then Docker.

### Phase 1: Database Foundation
**Rationale:** Every subsequent phase depends on a running database with schema and seed data. Cannot test repositories, services, or API endpoints without PostgreSQL tables.
**Delivers:** Prisma schema with all models (5 new: PdfExportJob, ReminderRule, ReminderExecution, CarryOverExecution, CarryOverRecord), initial migration, seed data (6 leads, 1 head, 1 viewer, projects, current report period).
**Addresses:** T3 (Prisma migrations + seed)
**Avoids:** Pitfall #2 (migration through PgBouncer) by establishing `directUrl` pattern from day one.
**Exit criteria:** `prisma studio` shows seeded data in all tables.

### Phase 2: NestJS Bootstrap + Prisma Repositories
**Rationale:** Services need real repository implementations before the transport layer. Must be testable at the service level (integration tests with real DB) before adding tRPC.
**Delivers:** PrismaModule (singleton PrismaService), 8 Prisma repository implementations, 8 NestJS domain modules, NestJS AppModule with HTTP listener, environment config (D7), CORS (D6), structured error handling (D2).
**Addresses:** T1 (NestJS bootstrap), T2 (Prisma repositories), D2, D6, D7
**Avoids:** Pitfall #5 (connection pool exhaustion) via global singleton PrismaService with explicit `connection_limit`; Pitfall #12 (transaction timeout) via explicit timeout on report assembly queries.
**Exit criteria:** Integration tests pass -- services read/write real PostgreSQL through Prisma repositories.

### Phase 3: tRPC Transport Layer
**Rationale:** Transport must work before auth (need working endpoints to test auth flow) and before frontend (need API to replace localStorage). Dev bypass (`AUTH_DEV_MODE=true`) provides session context during this phase.
**Delivers:** Unified tRPC AppRouter mapping all domain services to procedures, tRPC context factory (session extraction from JWT cookie), TrpcModule mounting at `/trpc`, deletion of old plain-object router files.
**Addresses:** T1 completion (tRPC adapter mounted on NestJS)
**Avoids:** Pitfall #3 (guards bypassed on tRPC) by implementing auth as tRPC middleware from the start.
**Exit criteria:** `curl localhost:3001/trpc/getActiveSection` returns data from PostgreSQL with dev bypass session.

### Phase 4: SAML Authentication
**Rationale:** Auth must be wired before frontend migration because the frontend needs a real session cookie to call tRPC endpoints. The auth primitives already exist as tested factory functions -- this phase wraps them in NestJS providers.
**Delivers:** AuthNestModule, Express routes for SAML login/callback, user find-or-create on SAML callback, JWT cookie lifecycle, Next.js middleware update for env-driven login URL.
**Addresses:** T6 (SAML SSO), D3 (request logging + correlation IDs)
**Avoids:** Pitfall #8 (SAML cert PEM format) via single-line base64 cert or volume mount; Pitfall #9 (callback domain mismatch) via same-domain architecture or token redirect flow.
**Exit criteria:** Full SAML login flow works with Keycloak dev instance -- user authenticates, cookie set, tRPC calls authenticated.

### Phase 5: Frontend Migration
**Rationale:** All backend endpoints must be working and authenticated before migrating the frontend. Converting localStorage to tRPC is a systematic page-by-page replacement -- attempting it before the API is stable means constant blocking.
**Delivers:** tRPC client setup (createTRPCReact, provider, httpBatchLink), migration of all 6 pages from localStorage to tRPC hooks, deletion of localStorage helpers and demo data files.
**Addresses:** T5 (Frontend tRPC client wiring)
**Avoids:** Pitfall #10 (hydration mismatch) via atomic cutover per component -- replace ALL data sources at once, no hybrid localStorage + API.
**Exit criteria:** Full user journey in browser against real API -- lead fills report, head reviews and publishes, archive displays history.

### Phase 6: Background Jobs
**Rationale:** PDF export and email reminders are additive -- the core report workflow is fully usable without them. Placing them after frontend migration means the entire happy path works before adding async complexity.
**Delivers:** QueuesModule (BullMQ registration), PdfExportProcessor (Playwright PDF generation), EmailReminderProcessor (nodemailer SMTP), Bull Board admin UI, health check for queue status.
**Addresses:** T7 (BullMQ jobs), D1 (health checks), D5 (rate limiting)
**Avoids:** Pitfall #4 (Redis eviction) via `noeviction` policy on queue Redis; Pitfall #11 (Date serialization) via explicit ISO string serialization + Zod parsing in workers; Pitfall #15 (worker not started) via in-process workers + health check endpoint.
**Exit criteria:** PDF export generates downloadable file; email reminder sends via SMTP.

### Phase 7: Docker Compose + Production Hardening
**Rationale:** Docker wraps everything. Building containers before the app works locally wastes debugging time in container context. This phase also adds production-readiness features.
**Delivers:** Multi-stage Dockerfiles (turbo prune + pnpm), docker-compose.yml (postgres, redis, api, web, migrate), docker-compose.dev.yml (volume mounts, hot reload), graceful shutdown (D4), PgBouncer (D8).
**Addresses:** T4 (Docker Compose), D4, D8
**Avoids:** Pitfall #6 (workspace:* in Docker) via turbo prune from monorepo root; Pitfall #7 (Prisma Client not generated) via explicit `prisma generate` in Dockerfile; Pitfall #13 (port conflicts) via non-standard host ports; Pitfall #14 (turbo prune lockfile) by avoiding `injectWorkspacePackages`.
**Exit criteria:** `docker compose up` starts full stack; E2E test passes in containerized environment.

### Phase Ordering Rationale

- **Database before everything** because every service, test, and endpoint depends on it
- **Repositories before tRPC** because tRPC procedures delegate to services which need repositories; integration-testable at service level
- **tRPC before auth** because working endpoints are needed to test auth flow end-to-end; dev bypass covers the gap
- **Auth before frontend** because frontend needs real cookies to call authenticated endpoints
- **Frontend after all backend** because every page depends on working tRPC endpoints; migrating before API is stable means constant blocking
- **Jobs late** because they are additive and do not block the core report workflow
- **Docker last** because it wraps a working application; debugging in containers is slower than debugging locally

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Prisma Repositories):** Highest complexity -- 8 repositories, nested relations, transactional writes. The `ReportSectionsPrismaRepository` involves 6 Prisma models in a single aggregate with nested includes. Needs careful schema-to-Zod mapping design.
- **Phase 4 (SAML Auth):** Cookie domain architecture needs a firm decision: same-domain reverse proxy vs token redirect flow. Test with actual Keycloak instance, not just dev bypass.
- **Phase 6 (Background Jobs):** Playwright PDF generation in a server context (headless Chromium inside Docker/NestJS) needs performance testing. Memory and concurrency limits must be established.

Phases with standard patterns (skip deeper research):
- **Phase 1 (Database Foundation):** Standard Prisma migrate + seed workflow, well-documented.
- **Phase 3 (tRPC Transport):** Official tRPC Express adapter pattern, codebase already has router contract.
- **Phase 5 (Frontend Migration):** Systematic localStorage-to-tRPC replacement, well-documented pattern.
- **Phase 7 (Docker Compose):** Official Turborepo Docker guide, standard multi-stage builds.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All packages verified against npm registry and official docs. No experimental or alpha dependencies. Every new package is either official NestJS or widely-used community standard. |
| Features | **HIGH** | Feature list derived from existing codebase analysis, not speculation. Every table-stakes feature maps to existing interfaces that need implementations. |
| Architecture | **HIGH** | Architecture follows the seams already present in v1 codebase. Repository pattern, tRPC contract, auth factories -- all designed for this exact integration. |
| Pitfalls | **HIGH** | All 5 critical pitfalls are documented in official sources (Prisma docs, BullMQ production guide, tRPC docs). None are speculative. |

**Overall confidence:** HIGH -- this is an infrastructure integration of a working prototype, not a speculative greenfield design. The domain logic is proven (51 unit tests). The integration patterns are standard and well-documented.

### Gaps to Address

- **Cookie domain architecture for SAML:** Must decide between (a) same-domain reverse proxy (nginx), (b) token redirect flow (API callback -> frontend /auth/complete), or (c) Docker Compose network with shared domain. This affects Phase 4 implementation. Decision should be made during Phase 4 planning, not deferred.
- **Prisma schema for 5 missing models:** `PdfExportJob`, `ReminderRule`, `ReminderExecution`, `CarryOverExecution`, `CarryOverRecord` exist as Zod schemas but not in `schema.prisma`. The Prisma models must match the Zod shapes exactly. Map these during Phase 1.
- **Shared router expansion:** The shared tRPC router in `packages/shared` currently defines only 4 procedures. Phase 3 needs 16+ procedures. Decide whether to expand the shared contract or generate the `AppRouter` type from the API and re-export.
- **Playwright in Docker:** Headless Chromium in Alpine-based Node.js containers requires additional OS dependencies (chromium, fonts). The Dockerfile for the API must install these. Test PDF rendering with actual report HTML in container context.
- **SMTP configuration:** Email reminders need a corporate SMTP relay. Connection details, auth method, and rate limits are not yet documented. Gather during Phase 6 planning.

## Sources

### Primary (HIGH confidence)
- [tRPC Express Adapter](https://trpc.io/docs/server/adapters/express) -- NestJS integration pattern
- [NestJS + Prisma Recipe](https://docs.nestjs.com/recipes/prisma) -- repository pattern
- [Prisma PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer) -- connection pooling
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production) -- Redis eviction policy
- [BullMQ + NestJS Guide](https://docs.bullmq.io/guide/nestjs) -- queue integration
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker) -- monorepo containerization
- [@node-saml/passport-saml](https://github.com/node-saml/passport-saml) -- SAML strategy
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management) -- pool configuration
- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error) -- frontend migration
- [@nestjs/terminus](https://www.npmjs.com/package/@nestjs/terminus) -- v11.1.1 health checks
- [@nestjs/bullmq](https://www.npmjs.com/package/@nestjs/bullmq) -- v11.0.4 queue integration
- [@bull-board/nestjs](https://www.npmjs.com/package/@bull-board/nestjs) -- v6.20.6 queue UI

### Secondary (MEDIUM confidence)
- [PgBouncer 1.21 Prepared Statements](https://pganalyze.com/blog/5mins-postgres-pgbouncer-prepared-statements-transaction-mode) -- prepared statement support
- [@willsoto/nestjs-prometheus](https://github.com/willsoto/nestjs-prometheus) -- community Prometheus integration
- [Turborepo issue #10584](https://github.com/vercel/turborepo/issues/10584) -- turbo prune lockfile bug (may be fixed by build time)
- Existing codebase analysis (all files read directly from repository)

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
